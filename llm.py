from langchain_core.messages.ai import AIMessage
from langchain_openai import ChatOpenAI
from langchain_core.messages import message_chunk_to_message, AIMessage, BaseMessage
from typing import Generator, List
from session import Session
from utils import log, LogLevel


class LLMToolCallError(Exception):
    """Exception indicating that invalid_tool_calls are still received after multiple retries."""

    def __init__(self, invalid_ai_messages):
        super().__init__("Too many invalid tool calls")
        self.invalid_ai_messages = invalid_ai_messages


def has_invalid_tool_calls(ai_msg: AIMessage) -> bool:
    return getattr(ai_msg, "invalid_tool_calls", False)


def llm_stream(
    llm: ChatOpenAI,
    history: List[BaseMessage],
) -> Generator[str, None, AIMessage]:
    combined = None

    for chunk in llm.stream(history):
        if getattr(chunk, "content", None):
            yield chunk.content
        combined = chunk if combined is None else (combined + chunk)

    ai_msg: AIMessage = message_chunk_to_message(combined)
    return ai_msg


def llm_invoke(
    llm: ChatOpenAI,
    history: List[BaseMessage],
) -> Generator[str, None, AIMessage]:
    ai_msg: AIMessage = llm.invoke(history)
    return ai_msg


def llm_tools_stream(
    llm_with_tools: ChatOpenAI,
    session: Session,
    retry: int = 5
) -> Generator[str, None, None]:
    """
    - retry invalid_tool_calls
    """
    invalid_ai_messages: List[BaseMessage] = []
    index = 0

    while index < retry:
        index += 1
        history = session.get_last_n_user_messages() + invalid_ai_messages

        ai_msg: AIMessage = yield from llm_stream(llm_with_tools, history)

        if has_invalid_tool_calls(ai_msg):
            # Don't write to session; only update temporary context and retry
            invalid_ai_messages.append(ai_msg)
            log(session.session_id, f"llm_tools_stream invalid_ai_messages: {invalid_ai_messages}",
                level=LogLevel.ERROR)
            continue

        # 4) Valid: write to session and end
        session.add_message(ai_msg)
        return

    log(session.session_id, f"llm_tools_stream failed, invalid_ai_messages: {invalid_ai_messages}",
        level=LogLevel.ERROR)
    raise LLMToolCallError(invalid_ai_messages[-1])


def llm_tools_invoke(
    llm_with_tools: ChatOpenAI,
    session: Session,
    retry: int = 5
) -> AIMessage:
    """
    - retry invalid_tool_calls
    """
    invalid_ai_messages: List[BaseMessage] = []
    index = 0

    while index < retry:
        index += 1
        history = session.get_last_n_user_messages() + invalid_ai_messages

        ai_msg: AIMessage = llm_invoke(llm_with_tools, history)
        if has_invalid_tool_calls(ai_msg):
            # Don't write to session; only update temporary context and retry
            invalid_ai_messages.append(ai_msg)
            log(session.session_id, f"llm_tools_stream invalid_ai_messages: {invalid_ai_messages}",
                level=LogLevel.ERROR)
            continue

        session.add_message(ai_msg)
        return ai_msg

    log(session.session_id, f"llm_tools_stream failed, invalid_ai_messages: {invalid_ai_messages}",
        level=LogLevel.ERROR)
    raise LLMToolCallError(invalid_ai_messages[-1])
