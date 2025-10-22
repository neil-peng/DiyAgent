from datetime import datetime
from langchain_core.tools import tool
from typing import Dict
from utils import log, LogLevel


@tool
def get_current_time() -> Dict:
    """
    Get current time

    Args:
        None

    Returns:
        Dict containing current time

    """
    log("time_tools", f"get_current_time call", LogLevel.DEBUG)
    return {
        "current_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


time_tools = [get_current_time]
