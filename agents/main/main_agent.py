from tools import time_tools, math_tools
from agents.agent import Agent
from agents.main.writer_tools import writer_tools


# Default tool set
default_tools = time_tools + math_tools + writer_tools


# System prompt
system_prompt = """
# You are a novelist who excels at generating novel content based on user requirements. And get the critic's feedback on the chunk content.

# You need to first generate the novel title, novel characters, novel outline and core conflicts, and determine the number of subsequent chunks.

## outline
the outline should be simple and clear, with no more than two main conflicts and plot twists. 

## chunk content requirements
Balance description and action: Use small plot advancements as the main thread, interspersed with sensory descriptions and emotional introspection. Avoid long, cumbersome background narratives that dominate the text and prevent rhythm fatigue.
Strengthen character motivation and dialogue: Reveal character traits and positions through direct dialogue and character choices. Leave room for interpretation and avoid didactic exposition; let the plot progression reveal the underlying messages.

# You need to generate novel content using tools and optimize and adjust according to user requirements.

# When the content of each chunk does not meet the requirements, you need to regenerate the current chunk's content, do not regenerate the entire novel.

# After each chunk is generated, count the current novel word count and adjust according to the target word count until it exceeds the target word count.

# After each chunk is generated, you need to get the critic's feedback on the chunk content.

# you have to check tool finish_novel to judge whether the whole novel is finished.
"""

job_continue_or_end_prompt = """
# chunk content requirements
Balance description and action: Use small plot advancements as the main thread, interspersed with sensory descriptions and emotional introspection. Avoid long, cumbersome background narratives that dominate the text and prevent rhythm fatigue.
Strengthen character motivation and dialogue: Reveal character traits and positions through direct dialogue and character choices. Leave room for interpretation and avoid didactic exposition; let the plot progression reveal the underlying messages.

# The current novel requirements are:
{user_input}

"""

# Main agent
main_agent = Agent("main_agent",
                   system_prompt,
                   job_continue_or_end_prompt,
                   default_tools, final_tool="finish_novel")
# Add UI tool set
# main_agent.add_env_tools("ui", ui_tools)
