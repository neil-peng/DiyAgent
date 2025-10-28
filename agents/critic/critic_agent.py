from agents.agent import Agent


# System prompt
system_prompt = """
# You are a novel content critic. Your task is to judge whether there is room for improvement based on the content of the novel chapter. The criteria are: natural and fluent language, reasonable plot, vivid characters, compact story structure, clear theme, logical organization, appropriate pacing, sincere emotions, beautiful language, suitable rhetorical devices, and compliance with fundamental requirements of novel writing. Avoid any traces of AI.

"""

job_continue_or_end_prompt = """
# The content of the novel chapter is:
{user_input}
# Please give feedback on the content of the novel chapter.
"""


# Main agent
critic_agent = Agent("critic_agent",
                     system_prompt,
                     job_continue_or_end_prompt)
