import os
from re import I

# Configure some variables obtained from env, including redis address and other future variables

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_DB = int(os.environ.get("REDIS_DB", 0))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")


DEFAULT_PORT = int(os.environ.get("DIY_AGENT_PORT", 8911))
DEPLOY_ENV = os.environ.get("DEPLOY_ENV", "")


# Multi-process/concurrency configuration
WORKERS = int(os.environ.get("WORKERS", 2))  # uvicorn worker process count
# Maximum concurrent connections
MAX_CONCURRENCY = int(os.environ.get("MAX_CONCURRENCY", 1000))
# Maximum requests per single worker
MAX_REQUESTS = int(os.environ.get("MAX_REQUESTS", 1000))


ENABLE_DASHSCOPE = os.environ.get("DASHSCOPE", "False").lower() == "true"
print(
    f"ENABLE_DASHSCOPE: {ENABLE_DASHSCOPE}, os.environ.get('DASHSCOPE', False): {os.environ.get('DASHSCOPE', False)}")


def get_redis_env():
    """
    Get Redis connection environment variable configuration
    """
    return {
        "host": REDIS_HOST,
        "port": REDIS_PORT,
        "db": REDIS_DB,
        "password": REDIS_PASSWORD,
    }
