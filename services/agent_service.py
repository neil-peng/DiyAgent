from agents.main.main_agent import system_prompt
from session import Session
from tools import ToolCallToConfirm
from typing import Generator
from langchain_core.messages import SystemMessage
from agents import main_agent
from utils.index_store import IndexStore
from fastapi.responses import StreamingResponse


def agent_call(session: Session, user_input: str, tool_calls_to_confirm_feedback: list[ToolCallToConfirm]) -> Generator:
    if session.get_message_count() == 0:
        session.add_message(SystemMessage(content=system_prompt))
    yield from main_agent.call(session, user_input, tool_calls_to_confirm_feedback)


def download_data(session_id: str) -> Generator:
    index_store = IndexStore(session_id)
    data = index_store.get_all()
    count = index_store.count()

    def generate():
        for i in range(count):
            yield data[str(i)]

    return StreamingResponse(
        content=generate(),
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename={session_id}.txt"
        }
    )
