from langchain.tools import tool
from typing_extensions import TypedDict
from typing import Annotated, Literal
import json


class Todo(TypedDict):
    """A single todo item with content and status."""

    content: str
    """The content/description of the todo item."""

    status: Literal["pending", "in_progress", "completed"]
    """The current status of the todo item."""


WRITE_TODOS_TOOL_DESCRIPTION = """使用此工具为你当前的工作会话创建和管理一个结构化的任务列表。这有助于你跟踪进度、组织复杂任务，并向用户展示你的工作完整性与严谨性。

仅当你认为该工具有助于保持工作有序时才使用它。如果用户的请求非常简单、少于 3 个步骤，最好不要使用该工具，而是直接完成任务。.

## When to Use This Tool
在以下场景中使用该工具:

1.	复杂的多步骤任务：当任务需要 3 个或以上明确的步骤或行动时
2.	非简单、较复杂的任务：需要仔细规划或执行多个操作的任务
3.	用户明确要求 todo list：用户直接要求你使用任务列表
4.	用户提供了多个任务：用户给出了一组需要完成的事项（编号或逗号分隔）
5.	计划可能需要根据前几步的结果进行后续修订或更新

## How to Use This Tool
1.	开始处理某个任务时，在正式开始工作前将其标记为 in_progress
2.	完成一个任务后，将其标记为 completed，并补充在实现过程中发现的后续任务
3.	你也可以更新未来任务，例如删除已不再需要的任务，或添加新出现的必要任务。不要修改已经完成的任务
4.	你可以一次性对 todo 列表进行多项更新。例如，在完成一个任务的同时，将下一个需要开始的任务标记为 in_progress.

## When NOT to Use This Tool
在以下情况下不要使用该工具：
1.	只有一个单一、直接的任务
2.	任务非常简单，记录它没有任何收益
3.	任务可以在少于 3 个简单步骤内完成
4.	任务纯属对话型或信息型内容

## Task States and Management

1. **任务状态**: 使用以下状态跟踪进度:
   - pending: 任务尚未开始
   - in_progress: 正在处理（如果任务彼此独立、可并行执行，可以同时有多个 in_progress）
   - completed: 任务已成功完成

2. **任务管理原则**:
   - 在工作过程中实时更新任务状态
   - 完成后立即标记为 completed（不要集中批量更新）
   - 在开始新任务前，先完成当前任务
   - 将不再相关的任务从列表中完全移除
   - IMPORTANT: 创建 todo 列表时，应立即将第一个任务（或第一批任务）标记为 in_progress
   - IMPORTANT: 除非所有任务都已完成，否则始终至少保留一个 in_progress 状态的任务，以向用户表明你正在推进工作

3. **任务完成的判定标准**:
   - 只有在任务被“完全完成”时，才可以标记为 completed
   - 如果遇到错误、阻塞或无法完成的情况，应保持任务为 in_progress
   - 在受阻时，新建一个任务描述需要解决的问题
   - 在以下情况下，绝不要将任务标记为 completed：
     - 存在未解决的问题或错误
     - 工作仅完成了一部分
     - 遇到了阻碍完成的阻塞因素
     - 无法找到必要的资源或依赖
     - 尚未达到质量标准

4. **任务拆分原则**:
   - 创建具体、可执行的任务项
   - 将复杂任务拆解为更小、更易管理的步骤
   - 使用清晰、描述性强的任务名称

积极、规范地进行任务管理，有助于体现你的专注度，并确保所有需求都能被完整、高质量地完成。
请记住：如果完成任务只需要少量工具调用，且操作目标非常明确，那么直接完成任务即可，不要使用该工具。"""

WRITE_TODOS_SYSTEM_PROMPT = """## `write_todos`

你可以使用 write_todos 工具来帮助你管理和规划复杂目标。

当面对复杂目标时，应使用该工具，以确保你能够跟踪每一个必要步骤，并向用户清晰展示你的推进进度。该工具在规划复杂目标、以及将大型复杂目标拆解为更小步骤时尤为有用。

一旦你完成了某个步骤，必须立即将对应的 todo 标记为 completed。不要在完成多个步骤后才集中一次性标记完成。

对于只需要少量步骤即可完成的简单目标，更好的做法是直接完成目标，而不要使用该工具。编写 todo 本身会消耗时间和 token，因此应在它确实有助于管理“多步骤、复杂问题”时再使用，而不适用于简单、步骤很少的请求。


## 需要牢记的 To-Do 列表使用要点
- write_todos 工具绝不能被并行多次调用。
- 在执行过程中，可以、也应该根据实际情况随时调整 To-Do 列表。新的信息可能会暴露出需要新增的任务，也可能使原有的一些任务变得不再相关."""


@tool(description=WRITE_TODOS_TOOL_DESCRIPTION)
def write_todos(todos: list[Todo]) -> str:
    """Create and manage a structured task list for your current work session."""
    return json.dumps(todos, ensure_ascii=False)


plan_tools = [write_todos]
