# DiyAgent - 极简AI Agent微框架
# Long story teller - 长文本生成助手
🌐 **Languages:**  
[English](README.md) | [中文](README.cn.md)

## 项目介绍

DiyAgent是一个基于极简agentic微框架构建的ai长文章生成助手

Diy的意思是这个项目仅仅作为一个参考实现一个最为简化的agentic ai应用的框架. 没有其他框架


### 样例小说

assets/- 查看assets目录中的小说样例文件


### 框架介绍

适合看懂最基本语法的各类人士

没有任何魔法，写好提示词， 定义好工具，仅此而已

multi-agent： 工具中再次调用下一个agent而已，树状展开

#### 三类数据格式输出

- **data** - 用于流式输出AI响应内容
- **tool_message** - 工具调用执行结果
- **tool_call** - 工具调用前的确认信息



### Agent组件

#### 1. Agent系统 (`agents/`)
```python
# 定义Agent的要素：提示词，工具，推理循环和工具确认
main_agent = Agent(
    name="main_agent",
    system_prompt=system_prompt,      # 系统提示词
    job_continue_prompt=job_prompt,   # 任务继续提示词  
    tools=default_tools              # 工具集合
)
```

#### 2. 工具系统 (`tools/`)
```python
@tool_with_confirm  # 支持确认机制的工具装饰器
def your_tool(param: str, reason: Optional[str] = None) -> str:
    """工具描述"""
    return "工具执行结果"
```

#### 3. 推理循环，Just loop 
```python
for i in range(max_step):
    # 1. 执行工具调用
    tool_messages, tool_calls_to_confirm = yield from tool_executor(session)
    
    # 2. 如果需要用户确认，暂停并返回确认信息
    if tool_calls_to_confirm:
        yield tool_calls_to_confirm
        return
    
    # 3. 如果没有工具调用，任务完成
    if not tool_messages:
        return
    
    # 4. 继续LLM对话
    ai_message = llm_invoke(session)
```


## 快速开始
请在docker-compose.yml中的
```yml
environment:
      - OPENAI_API_KEY=sk-xxx
```
替换成openai的apikey，然后启动命令：

```bash
docker-compose up -d
```

