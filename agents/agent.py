from langchain_openai.chat_models.base import ChatOpenAI


from langchain_openai.chat_models.base import ChatOpenAI
from langchain_core.messages.ai import AIMessage
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, ToolMessage, SystemMessage, HumanMessage

from session import Session
from utils import log, LogLevel
import env
from tools import ToolCallToConfirm
from tools import ToolExecutor
from utils.llm import llm_tools_invoke, llm_tools_stream
import json
from typing import Generator


if env.ENABLE_DASHSCOPE:
    quick_llm = ChatOpenAI(model="qwen-turbo-latest",
                           base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", extra_body={"enable_thinking": False})
    job_intent_llm = ChatOpenAI(model="qwen-turbo-latest",
                                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", extra_body={"enable_thinking": False})
else:
    quick_llm = ChatOpenAI(model="gpt-5-nano")
    job_intent_llm: ChatOpenAI = ChatOpenAI(model="gpt-5-nano")


enable_parallel_tool_calls = False


class Agent:
    def __init__(self, name: str,
                 system_prompt: str,
                 job_continue_or_end_prompt: str,
                 tools: list[str] = None,
                 max_step: int = 20,
                 final_tool: str = "final_answer"):
        self.name = name
        self.system_prompt = system_prompt
        self.job_continue_or_end_prompt = job_continue_or_end_prompt
        if tools is None:
            tools = []
        self.env_tools: dict[str, list[str]] = {
            "default": tools,
        }
        self.max_step = max_step
        self.final_tool = final_tool

    def add_env_tools(self, env: str, tools: list[str]):
        self.env_tools[env] = tools

    def delete_env_tools(self, env: str, tool_name: str):
        self.env_tools[env].remove(tool_name)
        if len(self.env_tools[env]) == 0:
            del self.env_tools[env]

    def call(self, session: Session, user_input: str,
             tool_calls_to_confirm_feedback: list[ToolCallToConfirm] = None) -> Generator:
        if user_input and tool_calls_to_confirm_feedback:
            raise Exception(
                "user_input and tool_calls_to_confirm_feedback cannot both be non-empty")

        if not user_input and not tool_calls_to_confirm_feedback:
            raise Exception(
                "user_input and tool_calls_to_confirm_feedback cannot both be empty")

        # Get tool set corresponding to environment information mode
        env = session.get_ctx("env")
        env_tag = env.get("tag", "default") if env is not None else "default"
        env_tools = self.env_tools[env_tag]
        tool_executor = ToolExecutor(env_tools, enable_confirmation=True)
        llm_with_tools = job_intent_llm.bind_tools(
            env_tools, parallel_tool_calls=enable_parallel_tool_calls)
        log(session.session_id,
            f"start react loop with env: {env_tag}, user_input: {user_input}, tool_calls_to_confirm_feedback: {tool_calls_to_confirm_feedback}",
            level=LogLevel.DEBUG)

        # First chat conversation
        if len(user_input) > 0:
            formatted_message: str = self.job_continue_or_end_prompt.format(
                user_input=user_input, env=session.get_ctx("env"))
            session.add_message(HumanMessage(content=formatted_message))
            yield from llm_tools_stream(llm_with_tools, session)

        last_ai_message: type[AIMessage] = None
        task_finish_flag: bool = False

        # Subsequent agent processing, the reason for this is to check that conversation is chat stream, task execution is agent invoke.
        for i in range(self.max_step):
            # Get tool call results and tool call confirmation feedback, support streaming processing
            tool_messages, tool_calls_to_confirm = yield from tool_executor(session, tool_calls_to_confirm_feedback)

            log(session.session_id, f"step {i}: task_finish_flag: {task_finish_flag}. len of tool_messages: {len(tool_messages)}. tool_calls_to_confirm:{tool_calls_to_confirm}",
                level=LogLevel.DEBUG)

            # No tool calls, no need to continue react
            if len(tool_calls_to_confirm) == 0 and len(tool_messages) == 0:
                if last_ai_message is not None:
                    # patch: cancel operation will not trigger final_answer
                    log(session.session_id,
                        f"task finished, last message:{last_ai_message.content}")
                    yield last_ai_message.content
                return

            # Tool interruption confirmation: return tool parameter confirmation result, subsequent tool processing supports batch tool calls.
            if len(tool_calls_to_confirm) > 0:
                log(session.session_id,
                    f"tool_calls_to_confirm: {tool_calls_to_confirm}", level=LogLevel.DEBUG)

                tool_call_to_confirm_dicts = []
                for tool_call_to_confirm in tool_calls_to_confirm:
                    tool_call_to_confirm_dicts.append(
                        tool_call_to_confirm.to_dict())
                yield tool_call_to_confirm_dicts
                return

            # Execute tool calls: get tool messages
            finish_answer_message = ToolMessage
            if len(tool_messages) > 0:
                # Return tool call results
                for tool_message in (m for m in tool_messages if m is not None):
                    # If tool call result is task completion, end loop
                    if tool_message.name == self.final_tool:
                        log(session.session_id, f"got task_finish: {tool_message}",
                            level=LogLevel.DEBUG)
                        task_finish_flag = True
                        finish_answer_message = tool_message
                    else:
                        yield tool_message

                # Add tool_message to session
                for tool_message in (m for m in tool_messages if m is not None):
                    session.add_message(tool_message)

            # If task completion is triggered, return result
            if task_finish_flag:
                answer = json.loads(finish_answer_message.content)
                log(session.session_id, f"task finished, answer:{answer}")
                yield answer
                return

            # Loop conversation
            last_ai_message = llm_tools_invoke(llm_with_tools, session)

        # fixme, boundary issue
        if i == self.max_step - 1:
            log(session.session_id, f"end of react loop: {last_ai_message}",
                level=LogLevel.DEBUG)
