from ast import And
import os
from typing import Any, Optional, Dict
from langchain_core.tools import tool
from tools import tool_with_confirm
from utils import log, LogLevel
from session import session_manager

output_dir = "assets"
if not os.path.exists(output_dir):
    os.makedirs(output_dir)


@tool_with_confirm
def set_story_language(
    language: str,
    reason: Optional[str] = None,
    session_id: Optional[str] = "writer_tools"
) -> str:
    """
    Set the story language
    Parameters:
    - language: story language
    - reason: reason for calling the tool, used to output the current step description
    Returns:
    - str: story language
    """
    log(session_id,
        f"set_story_language call with language: {language}, reason: {reason}", LogLevel.DEBUG)
    return f"Story language set to: {language}"


@tool_with_confirm
def prompt_title(
    title: str,
    reason: Optional[str] = None,
    session_id: Optional[str] = "writer_tools"
) -> str:
    """
    Generate novel title

    Parameters:
    - title: novel title
    - reason: reason for calling the tool, used to output the current step description
    Returns:
    - str: novel title
    """
    log(session_id,
        f"prompt_title call with title: {title}, reason: {reason}", LogLevel.DEBUG)
    session = session_manager.get_session(session_id)
    session.set_ctx("title", title)
    return f"小说标题：{title}"


@tool_with_confirm
def prompt_roles(
    roles: str,
    reason: Optional[str] = None,
    session_id: Optional[str] = "writer_tools"
) -> str:
    """
    Generate novel characters
    Parameters:
    - roles: novel characters description
    - reason: reason for calling the tool, used to output the current step description
    Returns:
    - str: novel characters
    """
    session = session_manager.get_session(session_id)
    title = session.get_ctx("title")
    if not title:
        log(session_id,
            f"title: {title}, prompt_roles call with reason: {reason}, error: Please generate novel title first", LogLevel.ERROR)
        return "Please generate novel title first"
    log(session_id,
        f"title: {title}, prompt_roles call with roles: {roles}, reason: {reason}", LogLevel.DEBUG)
    session = session_manager.get_session(session_id)
    session.set_ctx("roles", roles)
    return f"Novel characters: {roles}"


@tool_with_confirm
def prompt_story_outline(
    outline: str,
    reason: Optional[str] = None,
    session_id: Optional[str] = "writer_tools"
) -> str:
    """
    Generate novel outline and core conflicts and determine the number of subsequent chunks, for example, a 10,000 word novel can be divided into 10 chunks, each chunk approximately 1000 words. Each chunk needs to contain a complete story fragment.
    参数说明：
    - outline: novel outline and core conflicts and the number of subsequent chunks
    - reason: reason for calling the tool, used to output the current step description
    Returns:
    - str: novel outline and core conflicts
    """
    session = session_manager.get_session(session_id)
    title = session.get_ctx("title")
    if not title:
        log(session_id,
            f"title: {title}, prompt_roles call with reason: {reason}, error: Please generate novel title first", LogLevel.ERROR)
        return "Please generate novel title first"
    log(session_id,
        f"title: {title}, prompt_story_outline call with outline: {outline}, reason: {reason}", LogLevel.DEBUG)
    session = session_manager.get_session(session_id)
    session.set_ctx("story_outline", outline)
    return f"Novel outline: {outline}"


def count_content(session_id: str) -> int:
    session = session_manager.get_session(session_id)
    title = session.get_ctx("title")
    if not title:
        return 0
    filename = f"{output_dir}/{title}.txt"
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            count_content = f.read()
        count = len(count_content)
        return count
    except Exception as e:
        return 0


@tool_with_confirm
def prompt_chunk_content(
    chunk_index: int,
    content: str,
    reason: Optional[str] = None,
    session_id: Optional[str] = "writer_tools"
) -> str:
    """
    Generate novel content fragment, chunk_index starts from 1.
    If the previous chunk_index is not confirmed, regenerate the content of the previous chunk_index until the previous chunk_index is confirmed. 
    If the previous chunk_index is confirmed, generate the content of the current chunk_index, do not repeat the content of the previous chunk_index.

    Parameters:
    - chunk_index: content fragment index number
    - content: content fragment
    - reason: reason for calling the tool, used to output the current step description

    Returns:
    - str: content fragment
    """
    log(session_id,
        f"prompt_chunk_content call with chunk_index: {chunk_index}, content: {content}, reason: {reason}", LogLevel.DEBUG)

    session = session_manager.get_session(session_id)
    title = session.get_ctx("title")
    if not title:
        log(session_id,
            f"title: {title}, prompt_chunk_content call with reason: {reason}, error: Please generate novel title first", LogLevel.ERROR)
        return "Please generate novel title first"
    filename = f"{output_dir}/{title}.txt"
    log(session_id,
        f"save_chunk_content call with chunk_index: {chunk_index}, content: {content}, reason: {reason}", LogLevel.DEBUG)
    try:
        with open(filename, 'a', encoding='utf-8') as f:
            f.write(content)
        log(session_id,
            f"Successfully append the {chunk_index}th chunk content to the file: {filename}", LogLevel.DEBUG)
    except Exception as e:
        log(session_id,
            f"Error appending the {chunk_index}th chunk content to the file: {e}", LogLevel.ERROR)

    count = count_content(session_id)
    log(session_id,
        f"prompt_chunk_content call with chunk_index: {chunk_index}, content: {content}, reason: {reason}, result: 成功追加第{chunk_index}段内容到文件: {filename}, count: {count}", LogLevel.DEBUG)
    return f"Confirmed chunk_index: {chunk_index} \n\n Content fragment: {content} \n\n Total word count: {count}, Current chunk word count: {len(content)} \n\n"

# @tool_with_confirm
# def refine_chunk_content(
#     chunk_index: int,
#     content: str,
#     reason: Optional[str] = None
# ) -> Dict:
#     """
#     Optimize novel content fragment based on the comments of the commentator
#     """
#     return content


# @tool
# def comment_chunk_content(
#     chunk_index: int,
#     comment: str,
#     reason: Optional[str] = None
# ) -> Dict:
#     """
#     Commentator comments on the novel content fragment
#     """
#     return comment


@tool_with_confirm
def finish_writing(
    answer: Optional[str] = None,
    session_id: Optional[str] = "writer_tools",
    reason: Optional[str] = None
) -> str:
    """
    Complete novel writing, need to ensure that the novel word count meets the requirements, and the novel content meets the requirements.
    Parameters:
    - answer: answer
    - reason: reason for calling the tool, used to output the current step description
    Returns:
    - str: answer
    """
    session = session_manager.get_session(session_id)
    title = session.get_ctx("title")
    filename = f"{output_dir}/{title}.txt"
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        count = len(content)
    except Exception as e:
        log(session_id,
            f"finish_writing call with reason: {reason}, error: {e}", LogLevel.ERROR)
        return {"count": 0}

    log(session_id,
        f"finish_writing call with answer: {answer}, result: finish job, count: {count}", LogLevel.DEBUG)
    return answer


writer_tools = [set_story_language, prompt_title,
                prompt_roles, prompt_story_outline, prompt_chunk_content, finish_writing]
