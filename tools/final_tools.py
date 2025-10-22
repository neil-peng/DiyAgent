from langchain_core.tools import tool


@tool
def final_answer(answer: str) -> str:
    """
      Return the final answer
      if the task is only to confirm tool message or show tool result, return empty string

      Args:
          answer: the task‘s final answer. if the task is only to confirm tool message or show tool result, return empty string
      Returns:
          the task‘s final answer
      """
    return answer


final_tool = [final_answer]
