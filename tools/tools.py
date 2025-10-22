from langchain_core.messages import ToolMessage, AIMessage
import json
from dataclasses import dataclass
from langchain_core.messages.base import BaseMessage
from utils import log, LogLevel
from session import Session
from typing import Optional
from typing import Generator
from langchain_core.tools import tool

from typing import Callable, Any, Dict


def tool_with_confirm(
    func=None,
    *,
    require_confirm: bool = True,
    **tool_kwargs
):
    """
    Tool decorator with confirmation functionality
    """

    def _make_tool_with_confirm(f: Callable) -> Callable:
        # First apply langchain's @tool decorator
        tool_func = tool(**tool_kwargs)(f)
        # Add confirmation identifier attribute
        object.__setattr__(tool_func, 'require_confirm', require_confirm)
        return tool_func

    if func is None:
        # Parameterized call: @tool_with_confirm(require_confirm=False)
        return _make_tool_with_confirm
    else:
        # Non-parameterized call: @tool_with_confirm
        return _make_tool_with_confirm(func)


@dataclass
class ToolCallToConfirm:
    tool_call_name: Optional[str]
    tool_call_id: Optional[str]
    tool_call_args: Optional[dict]
    tool_confirm_action: Optional[str]

    def to_dict(self) -> dict:
        """
        Convert dataclass object to dictionary

        Returns:
            dict: Dictionary containing all fields
        """
        return {
            "tool_call_name": self.tool_call_name,
            "tool_call_id": self.tool_call_id,
            "tool_call_args": self.tool_call_args,
            "tool_confirm_action": self.tool_confirm_action,
        }


def default_confirmation_callback(tool_call: dict) -> bool:
    """
    Default confirmation callback function - console interactive confirmation

    Args:
        tool_call: Tool call information, including name, args, id, etc.

    Returns:
        bool: True means confirm execution, False means cancel
    """
    tool_name = tool_call["name"]
    tool_args = tool_call["args"]

    log("tools", f"prepare to execute tool call:")
    log("tools", f"tool name: {tool_name}")
    log("tools", f"tool args: {tool_args}")

    while True:
        user_input = input("continue to execute? (y/n): ").strip().lower()
        if user_input in ['y', 'yes']:
            return True
        elif user_input in ['n', 'no']:
            return False
        else:
            print("please input y/n")


def ui_confirmation_callback(tool_call: dict, tool_call_to_confirms: list[ToolCallToConfirm]) -> str:
    """
    UI confirmation callback function - supports function-level confirmation configuration

    Args:
        tool_call: Current tool call information, including name, args, id, etc.
        tool_call_to_confirms: Confirmed tool call information

    Returns:
        str: "confirmed" means confirm execution, "cancelled" means cancel, "to_confirm" means needs confirmation
    """

    if tool_call_to_confirms is not None and len(tool_call_to_confirms) > 0:
        for tool_call_to_confirm in tool_call_to_confirms:
            if tool_call_to_confirm.tool_call_id == tool_call["id"]:
                if tool_call_to_confirm.tool_confirm_action == "confirmed":
                    return "confirmed"
                elif tool_call_to_confirm.tool_confirm_action == "cancelled":
                    return "cancelled"

    return "to_confirm"


def check_tool_requires_confirmation(tool_executor: 'ToolExecutor', tool_name: str) -> bool:
    """
    Check if tool requires confirmation

    Args:
        tool_executor: Tool executor instance
        tool_name: Tool name

    Returns:
        bool: Whether confirmation is needed, default is no confirmation needed
    """
    tool = tool_executor.tools_by_name.get(tool_name)
    if tool and hasattr(tool, 'require_confirm'):
        return tool.require_confirm
    else:
        # Default no confirmation needed
        return False


class ToolExecutor:
    """
    Tool executor, executes tools in the tool set
    """

    def __init__(self, tools: list, enable_confirmation: bool = False) -> None:
        """
        Initialize tool executor
        ToolExecutor will not write to session
        Args:
            tools: Tool list
            enable_confirmation: Whether to enable user confirmation, default False for backward compatibility
        """
        self.tools_by_name = {tool.name: tool for tool in tools}
        self.enable_confirmation = enable_confirmation

    def __call__(self, session: Session, tool_calls_to_confirm_feedback: list[ToolCallToConfirm]) -> Generator[str, None, tuple[list[ToolMessage], list[ToolCallToConfirm]]]:
        tool_messages: list[ToolMessage] = []

        log(session.session_id, f"tool_calls_to_confirm_feedback: {tool_calls_to_confirm_feedback}",
            level=LogLevel.DEBUG)

        tool_calls_to_confirm: list[ToolCallToConfirm] = []
        # If messages exist in session, need to determine whether to call tools
        if session.get_message_count() > 0:
            # Get the last message in the session
            message: BaseMessage = session.get_last_message()
            log(session.session_id, f"last ai_message: {message}",
                level=LogLevel.DEBUG)
            if isinstance(message, AIMessage) and message.tool_calls is not None:
                # Iterate through tool calls in the message
                for tool_call in message.tool_calls:
                    log(session.session_id, f"tool_call: {tool_call}, content: {message.content}",
                        level=LogLevel.DEBUG)

                    # If user confirmation is enabled, user confirmation is required
                    if self.enable_confirmation:
                        # Use new confirmation check function
                        requires_confirm = check_tool_requires_confirmation(
                            self, tool_call["name"])

                        if requires_confirm:
                            confirmed: str = ui_confirmation_callback(
                                tool_call, tool_calls_to_confirm_feedback)
                            log(session.session_id,
                                f"confirmed: {confirmed}", level=LogLevel.DEBUG)

                            # If llm infers auth_token, delete this inferred auth_token parameter
                            if "auth_token" in tool_call["args"]:
                                log(session.session_id, f"Delete inferred auth_token parameter: {tool_call['args']}",
                                    level=LogLevel.ERROR)
                                del tool_call["args"]["auth_token"]
                            if confirmed == "to_confirm":
                                log(session.session_id, f"User confirmation required: {tool_call['name']}",
                                    level=LogLevel.DEBUG)
                                if "reason" in tool_call["args"]:
                                    tool_call_reason = tool_call["args"]["reason"]
                                else:
                                    tool_call_reason = tool_call["name"]
                                tool_calls_to_confirm.append(ToolCallToConfirm(
                                    tool_call_name=tool_call_reason,
                                    tool_call_id=tool_call["id"],
                                    tool_call_args=tool_call["args"],
                                    tool_confirm_action="to_confirm",
                                ))
                                continue
                            elif confirmed == "cancelled":
                                log(session.session_id, f"User cancelled tool call: {tool_call['name']}",
                                    level=LogLevel.DEBUG)
                                # If user refuses, return a message indicating refusal
                                tool_messages.append(
                                    ToolMessage(
                                        content=json.dumps({
                                            "status": "cancelled",
                                            "message": f"User cancelled tool call: {tool_call['name']}"
                                        }, ensure_ascii=False),
                                        name=tool_call["name"],
                                        tool_call_id=tool_call["id"],
                                    )
                                )
                                continue
                        else:
                            # No confirmation needed, execute directly
                            pass

                    # Execute tool call
                    # auth_token needs to be obtained from session, cannot be inferred
                    auth_token = session.get_ctx("authorization_token")
                    tool_call["args"]["auth_token"] = auth_token
                    tool_call["args"]["session_id"] = session.session_id
                    log(session.session_id, f"invoke tool_call: {tool_call}",
                        level=LogLevel.DEBUG)
                    tool_result = self.tools_by_name[tool_call["name"]].invoke(
                        tool_call["args"],
                    )
                    log(session.session_id, f"invoke tool_result: {tool_result}",
                        level=LogLevel.DEBUG)

                    if "reason" in tool_call["args"]:
                        tool_call_reason = tool_call["args"]["reason"]
                    else:
                        tool_call_reason = tool_call["name"]

                    # If tool returns a generator, handle it in streaming mode
                    if isinstance(tool_result, Generator):
                        tool_result = yield from tool_result
                        log(session.session_id, f"yield from tool_result: {tool_result}",
                            level=LogLevel.DEBUG)
                        # If tool returns a generator, handle as stream data, llm no longer further processes tool results
                        session.add_message(ToolMessage(
                            content=json.dumps(
                                tool_result, ensure_ascii=False),
                            name=tool_call_reason,
                            tool_call_id=tool_call["id"],
                        ))
                        return [], []

                    tool_messages.append(
                        ToolMessage(
                            content=json.dumps(
                                tool_result, ensure_ascii=False),
                            name=tool_call_reason,
                            tool_call_id=tool_call["id"],
                        )
                    )

        return tool_messages, tool_calls_to_confirm
