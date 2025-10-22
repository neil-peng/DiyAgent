import colorama
import inspect
import os
from datetime import datetime
from enum import Enum

# Initialize colorama
colorama.init()


class LogLevel(Enum):
    INFO = '\033[92m'  # Green
    WARNING = '\033[93m'  # Yellow
    ERROR = '\033[91m'  # Red
    DEBUG = '\033[94m'  # Blue


def log(session_id: str, message: str, level: LogLevel = LogLevel.INFO):
    """Colored log output function, including calling function name and line number, with persistence to file"""
    # Get call stack information
    caller_frame = inspect.currentframe().f_back
    if caller_frame:
        caller_info = inspect.getframeinfo(caller_frame)
        # Only take filename, not full path
        filename = caller_info.filename.split('/')[-1]
        function_name = caller_info.function
        line_number = caller_info.lineno
        caller_info_str = f"[{filename}:{function_name}:{line_number}]"
    else:
        caller_info_str = "[unknown]"

    # Format log message
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_message = f"{timestamp} {level.name} {caller_info_str} {message}"

    # Console output (with color)
    print(f"{session_id}:{level.value}{caller_info_str} {message}\033[0m")

    # Persist to file
    try:
        # Ensure log directory exists
        log_dir = "log"
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)

        # Write to session-specific log file
        log_file_path = os.path.join(log_dir, f"{session_id}.log")
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(log_message + "\n")
    except Exception as e:
        # If file writing fails, at least ensure console output
        print(f"\033[91m[LOG_ERROR] Failed to write to log file: {e}\033[0m")
