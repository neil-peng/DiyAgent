from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Any, Generator, Optional
import openai

from utils import log, LogLevel
from main import agent_call

from langchain_core.messages import ToolMessage
from otel import tracer
import json
from opentelemetry.trace import Status, StatusCode
import uuid
import traceback
from session import session_manager
from tools import ToolCallToConfirm
from env import DEFAULT_PORT, WORKERS, MAX_CONCURRENCY, MAX_REQUESTS
from llm import LLMToolCallError
from history import history_manager

# Create FastAPI application
app = FastAPI()

base_url = "/diy-agent/"

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StreamRequest(BaseModel):
    """
    Streaming API request structure
    """
    message: str
    sessionId: Optional[str] = None
    env: Optional[dict] = None
    tool_calls: Optional[list[ToolCallToConfirm]] = None


def get_headers(request: Request):
    """
    Extract necessary information from request headers, including JWT parsing
    """
    headers = request.headers
    authorization = headers.get(
        "Authorization") or headers.get("authorization")

    return {
        "authorization": authorization
    }


def get_session_id(request: Request, req_session_id: Optional[str] = None):
    """
    Logic for getting session_id:
    1. If sessionId exists in request, use it directly
    2. If no sessionId, generate from AccountId and UserId in header
    3. If no AccountId or UserId in header, generate UUID
    """
    # If session_id is provided, use it directly
    if req_session_id:
        return req_session_id

    # Otherwise generate UUID
    return str(uuid.uuid4())


@app.get("/actuator/ping")
async def ping():
    log("ping", LogLevel.INFO)
    return {"message": "pong"}


@app.get("/actuator/health")
async def actuator_health():
    return {"status": "UP"}


@app.post(base_url + "stream/")
async def stream_invoke(req: StreamRequest, request: Request):

    # Extract headers (including JWT authentication)
    header_info = get_headers(request)
    authorization = header_info["authorization"]

    # Generate session_id
    session_id = get_session_id(request, req.sessionId)

    # Get a session
    session = session_manager.get_session(session_id)
    # Store authorization to session
    if authorization:
        session.set_ctx("authorization_token", authorization)
    session.set_ctx("session_id", session_id)
    session.set_ctx("env", req.env or {})
    log(session_id, f"stream_invoke: {req}", LogLevel.INFO)

    def sse_generator() -> Generator[str, Any, None]:
        with tracer.start_as_current_span(
            "stream_invoke", openinference_span_kind="agent",
            attributes={"session_id": session_id, "env": req.env}
        ) as span:
            # Set span input, temporarily add sessionid
            req.sessionId = session_id
            span.set_input(req)

            try:
                output = ""
                for content in agent_call(session, req.message, req.tool_calls):
                    if content:  # Only send when content is not empty
                        str_content = ""
                        if isinstance(content, str):
                            # AI message
                            str_content = f"data: {json.dumps({'content': content}, ensure_ascii=False)}\n\n"
                            yield str_content
                        elif isinstance(content, ToolMessage):
                            # Tool result message
                            str_content = f"tool_message: {json.dumps(content.to_json()['kwargs'], ensure_ascii=False)}\n\n"
                            yield str_content
                        else:
                            # Tool call confirmation
                            str_content = f"tool_call: {json.dumps(content, ensure_ascii=False)}\n\n"
                            yield str_content
                        output += str_content

                span.set_status(Status(StatusCode.OK))
                span.set_output(output)
            except Exception as e:
                error_message = str(e)
                stack_trace = traceback.format_exc()
                log(session_id,
                    f"agent_call error: {error_message}", LogLevel.ERROR)
                log(session_id,
                    f"Full stack trace:\n{stack_trace}", LogLevel.ERROR)
                span.set_attribute("error_message", error_message)
                span.set_attribute("stack_trace", stack_trace)
                span.set_status(Status(StatusCode.ERROR))
                if isinstance(e, LLMToolCallError):
                    str_content = f"data: {json.dumps({'content': "Unable to answer, please ask again"}, ensure_ascii=False)}\n\n"
                    yield str_content
                log(session_id,
                    f"agent_call error: {e}, type: {type(e)}", LogLevel.ERROR)
                # Check if it's an error where tool_call_id has no response message
                if isinstance(e, openai.BadRequestError):
                    log(session_id, "tool_call_id error, clean session",
                        LogLevel.WARNING)
                    try:
                        # Clean up messages containing tool_call
                        session.cleanup_tool_call_messages()
                        log(session_id, "session cleaned, retry agent_call",
                            LogLevel.INFO)

                        # Retry calling agent_call
                        for content in agent_call(session, req.message, req.tool_calls):
                            if content:  # Only send when content is not empty
                                if isinstance(content, str):
                                    yield f"data: {json.dumps({'type': 'data', 'content': content}, ensure_ascii=False)}\n\n"
                                elif isinstance(content, ToolMessage):
                                    yield f"tool_message: {json.dumps(content.to_json(), ensure_ascii=False)}\n\n"
                                else:
                                    yield f"tool_call: {json.dumps(content, ensure_ascii=False)}\n\n"
                    except Exception as retry_error:
                        log(session_id, f"retry agent_call error: {str(retry_error)}",
                            LogLevel.ERROR)
                        error_response = {
                            'type': 'error',
                            'content': f'Error occurred while processing request, session state has been cleaned. Error message: {str(retry_error)}'
                        }
                        yield f"data: {json.dumps(error_response, ensure_ascii=False)}\n\n"
                else:
                    # Other types of exceptions, return error directly
                    log(session_id,
                        f"agent_call other exception occurred: {error_message}", LogLevel.ERROR)
                    error_response = {
                        'type': 'error',
                        'content': f'Error occurred while processing request: {error_message}'
                    }
                    yield f"data: {json.dumps(error_response, ensure_ascii=False)}\n\n"

    # Store conversation history
    def history_collecting_generator():
        collected_responses = []
        user_input = req.message

        try:
            for chunk in sse_generator():
                collected_responses.append(chunk)
                yield chunk
        finally:
            # Save history after generator ends
            if collected_responses:
                try:
                    history_manager.save_interaction(
                        session_id, user_input, collected_responses, "")
                except Exception as e:
                    print(
                        f"Error saving history for session {session_id}: {e}")

    return StreamingResponse(history_collecting_generator(), media_type="text/event-stream")


@app.get(base_url + "session-history/{session_id}")
async def get_session_history_api(session_id: str, request: Request, limit: int = 50):
    """Get session history"""
    # JWT authentication check
    header_info = get_headers(request)
    user_id = header_info["user_id"]
    if not user_id:
        raise HTTPException(
            status_code=401, detail="Invalid JWT token or UserId not found")

    try:
        history = history_manager.get_session_history(session_id, limit)
        return {
            "session_id": session_id,
            "history": history,
            "total": len(history)
        }
    except Exception as e:
        log(session_id, f"get session history error: {e}", LogLevel.ERROR)
        return {"error": str(e)}


@app.delete(base_url + "session-history/{session_id}")
async def clear_session_history_api(session_id: str, request: Request):
    """Clear session history"""
    # JWT authentication check
    header_info = get_headers(request)
    user_id = header_info["user_id"]
    if not user_id:
        raise HTTPException(
            status_code=401, detail="Invalid JWT token or UserId not found")

    try:
        success = history_manager.clear_session_history(session_id)
        return {
            "session_id": session_id,
            "success": success,
            "message": "History cleared" if success else "No history found"
        }
    except Exception as e:
        log(session_id, f"clear session history error: {e}", LogLevel.ERROR)
        return {"error": str(e)}


@app.get(base_url + "user-sessions")
async def get_user_sessions_api(request: Request, limit: int = 100):
    """Get all user session lists and metadata"""
    # JWT authentication check
    header_info = get_headers(request)
    user_id = header_info["user_id"]
    if not user_id:
        raise HTTPException(
            status_code=401, detail="Invalid JWT token or UserId not found")

    try:
        sessions = history_manager.get_user_sessions_with_meta(user_id, limit)
        return {
            "user_id": user_id,
            "sessions": sessions,
            "total": len(sessions)
        }
    except Exception as e:
        log(user_id, f"get user sessions error: {e}", LogLevel.ERROR)
        return {"error": str(e)}


@app.delete(base_url + "user-sessions")
async def clear_user_sessions_api(request: Request):
    """Clear all user session records"""
    # JWT authentication check
    header_info = get_headers(request)
    user_id = header_info["user_id"]
    if not user_id:
        raise HTTPException(
            status_code=401, detail="Invalid JWT token or UserId not found")

    try:
        # First get all user session IDs
        session_ids = history_manager.get_user_sessions(user_id)

        # Clear history for each session
        cleared_sessions = 0
        for session_id in session_ids:
            if history_manager.clear_session_history(session_id):
                cleared_sessions += 1

        # Clear user session list
        success = history_manager.clear_user_sessions(user_id)

        return {
            "user_id": user_id,
            "success": success,
            "cleared_sessions": cleared_sessions,
            "message": f"Cleared {cleared_sessions} session records for user {user_id}" if success else "Clear failed"
        }
    except Exception as e:
        log(user_id, f"clear user sessions error: {e}", LogLevel.ERROR)
        return {"error": str(e)}


@app.delete(base_url + "user-sessions/{session_id}")
async def remove_user_session_api(session_id: str, request: Request):
    """Remove specified session from user session list"""
    # JWT authentication check
    header_info = get_headers(request)
    user_id = header_info["user_id"]
    if not user_id:
        raise HTTPException(
            status_code=401, detail="Invalid JWT token or UserId not found")

    try:
        # Remove user session association
        history_manager.remove_user_session(user_id, session_id)

        # Clear history for this session
        session_cleared = history_manager.clear_session_history(session_id)

        return {
            "user_id": user_id,
            "session_id": session_id,
            "success": True,
            "session_cleared": session_cleared,
            "message": f"Removed session {session_id} from user {user_id}'s session list"
        }
    except Exception as e:
        log(f"{user_id}_{session_id}",
            f"remove user session error: {e}", LogLevel.ERROR)
        return {"error": str(e)}


@app.get(base_url + "session-meta/{session_id}")
async def get_session_meta_api(session_id: str, request: Request):
    """Get session metadata"""
    # JWT authentication check
    header_info = get_headers(request)
    user_id = header_info["user_id"]
    if not user_id:
        raise HTTPException(
            status_code=401, detail="Invalid JWT token or UserId not found")

    try:
        meta = history_manager.get_session_meta(session_id)

        # Verify if user has permission to access this session
        if meta.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        return {
            "session_id": session_id,
            "meta": meta
        }
    except HTTPException:
        raise
    except Exception as e:
        log(session_id, f"get session meta error: {e}", LogLevel.ERROR)
        return {"error": str(e)}


@app.put(base_url + "session-meta/{session_id}")
async def update_session_meta_api(session_id: str, request: Request):
    """Update session metadata"""
    # JWT authentication check
    header_info = get_headers(request)
    user_id = header_info["user_id"]
    if not user_id:
        raise HTTPException(
            status_code=401, detail="Invalid JWT token or UserId not found")

    try:
        # Get request body
        body = await request.json()
        title = body.get("title")

        if not title:
            raise HTTPException(status_code=400, detail="Title is required")

        # Verify if user has permission to modify this session
        existing_meta = history_manager.get_session_meta(session_id)
        if existing_meta.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Update title
        history_manager.update_session_title(session_id, title)

        return {
            "session_id": session_id,
            "title": title,
            "success": True,
            "message": f"Session title updated to: {title}"
        }
    except HTTPException:
        raise
    except Exception as e:
        log(session_id, f"update session meta error: {e}", LogLevel.ERROR)
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    import os
    cpu_count = os.cpu_count() or 1
    workers_count = WORKERS if WORKERS > 0 else cpu_count

    log("server",
        f"Starting server with {workers_count} workers, max concurrency: {MAX_CONCURRENCY}", LogLevel.INFO)

    # When workers>1, use import string; when workers=1, pass app object directly
    if workers_count > 1:
        app = "server:app"
    uvicorn.run(
        app,  # Use import string
        host="0.0.0.0",
        port=DEFAULT_PORT,
        workers=workers_count,
        limit_concurrency=MAX_CONCURRENCY,
        limit_max_requests=MAX_REQUESTS,
        access_log=True,
        use_colors=True,
    )
