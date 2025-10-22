import os
from phoenix.otel import register
from openinference.instrumentation import TracerProvider
from utils import log, LogLevel

PROJECT_NAME = os.getenv("PROJECT_NAME", "dataui-dev")

PHOENIX_ENDPOINT = "http://localhost:6006"
TRACE_TOKEN = "Bearer xxx"
ENABLE_TRACE = bool(os.getenv("ENABLE_TRACE", False))
log("otel",
    f"ENABLE_TRACE: {ENABLE_TRACE}, PROJECT_NAME: {PROJECT_NAME}, PHOENIX_ENDPOINT: {PHOENIX_ENDPOINT}, TRACE_TOKEN: {TRACE_TOKEN}", LogLevel.INFO)

# Only initialize Phoenix when trace is enabled
if ENABLE_TRACE:
    phoenix_endpoint = PHOENIX_ENDPOINT
    log("otel", f"phoenix_endpoint: {phoenix_endpoint}", LogLevel.INFO)

    # Ensure endpoint ends with "/"
    if not phoenix_endpoint.endswith("/"):
        phoenix_endpoint += "/"

    tracer_provider = register(
        project_name=PROJECT_NAME,
        headers={"Authorization": TRACE_TOKEN},
        batch=True,
        endpoint=phoenix_endpoint + "v1/traces",
        auto_instrument=True
    )

    # OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
    tracer = tracer_provider.get_tracer(__name__)
    # LangChainInstrumentor().instrument(tracer_provider=tracer_provider)

else:
    # When trace is not enabled, create an empty tracer
    tracer_provider = TracerProvider()
    tracer = tracer_provider.get_tracer(__name__)
    log("otel", "Tracing is disabled", LogLevel.INFO)
