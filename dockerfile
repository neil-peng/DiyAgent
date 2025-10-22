FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制项目文件
COPY . .

# 安装 Python 依赖
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    redis \
    langchain-openai \
    langchain-core \
    pydantic \
    colorama \
    openai \
    tabulate \
    arize-phoenix \
    opentelemetry-api

# 创建日志目录
RUN mkdir -p /app/log

EXPOSE 8911

CMD ["python", "server.py"]
