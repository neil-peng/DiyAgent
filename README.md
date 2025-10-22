# DiyAgent - Minimalist AI Agent Micro-Framework
# Long story teller - Long Text Generation Assistant
🌐 **Languages:**  
[English](README.md) | [中文](README.cn.md)

## Project Introduction

DiyAgent is an AI long article generation assistant built on a minimalist agentic micro-framework.

The meaning of "Diy" is that this project serves only as a reference implementation of the most simplified agentic AI application framework. No other frameworks involved.

### Framework Introduction

Suitable for all kinds of people who understand the most basic syntax.

No magic at all, just write good prompts and define tools, that's it.

Multi-agent: Simply calling the next agent within tools, expanding in a tree structure.

#### Three Types of Data Format Output

- **data** - For streaming AI response content output
- **tool_message** - Tool execution results
- **tool_call** - Confirmation information before tool execution

### Agent Components

#### 1. Agent System (`agents/`)
```python
# Define Agent elements: prompts, tools, reasoning loop and tool confirmation
main_agent = Agent(
    name="main_agent",
    system_prompt=system_prompt,      # System prompt
    job_continue_prompt=job_prompt,   # Task continuation prompt  
    tools=default_tools              # Tool collection
)
```

#### 2. Tool System (`tools/`)
```python
@tool_with_confirm  # Tool decorator with confirmation mechanism
def your_tool(param: str, reason: Optional[str] = None) -> str:
    """Tool description"""
    return "Tool execution result"
```

#### 3. Reasoning Loop, Just loop
```python
for i in range(max_step):
    # 1. Execute tool calls
    tool_messages, tool_calls_to_confirm = yield from tool_executor(session)
    
    # 2. If user confirmation needed, pause and return confirmation info
    if tool_calls_to_confirm:
        yield tool_calls_to_confirm
        return
    
    # 3. If no tool calls, task completed
    if not tool_messages:
        return
    
    # 4. Continue LLM conversation
    ai_message = llm_invoke(session)
```

## Quick Start
Please replace the OpenAI API key in docker-compose.yml:
```yml
environment:
      - OPENAI_API_KEY=sk-xxx
```
Replace with your OpenAI API key, then start with the command:

```bash
docker-compose up -d
```
