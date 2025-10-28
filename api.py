from server import app, base_url
from fastapi import Request
from services.agent_service import download_data


@app.get(base_url + "download/{session_id}")
async def download_data_api(session_id: str, request: Request):
    return download_data(session_id)
