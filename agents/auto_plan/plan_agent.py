from tools import time_tools, math_tools
from agents.agent import Agent
from agents.main.writer_tools import writer_tools
from tools.plan_tools import plan_tools, WRITE_TODOS_SYSTEM_PROMPT

# Default tool set
default_tools = time_tools + math_tools + \
    writer_tools + plan_tools


# System prompt
system_prompt = """
# you are a novelist who excels at generating novel content based on user requirements. 
# you have to use tool write_todos to plan the novel. and check the todo list to see if all the tasks are completed.
# 在执行完每个任务后，你需要更新todo list，并检查todo list是否已经完成。如果没有完成，你需要尝试调用工具继续执行下一个任务。
# you have to check tool finish_novel after each task is completed to judge whether the whole novel is finished.
"""

job_continue_or_end_prompt = """
# chunk content requirements
Balance description and action: Use small plot advancements as the main thread, interspersed with sensory descriptions and emotional introspection. Avoid long, cumbersome background narratives that dominate the text and prevent rhythm fatigue.
Strengthen character motivation and dialogue: Reveal character traits and positions through direct dialogue and character choices. Leave room for interpretation and avoid didactic exposition; let the plot progression reveal the underlying messages.

# The current novel requirements are:
{user_input}

"""

# Main agent
auto_plan_agent = Agent("auto_plan_agent",
                        system_prompt + WRITE_TODOS_SYSTEM_PROMPT,
                        job_continue_or_end_prompt,
                        default_tools)
