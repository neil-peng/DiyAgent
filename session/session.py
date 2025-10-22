import abc
import json
from typing import Awaitable, Any
from redis import Redis
from env import get_redis_env
from langchain_core.messages import BaseMessage, AIMessage, HumanMessage, SystemMessage
from langchain_core.load import load
from utils import log, LogLevel
from collections import deque
from typing import List

_n_humans = 30


class Session(abc.ABC):
    """
    Message list for storing messages.
    """

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.ctx = {}
        self.n_humans = _n_humans

    @abc.abstractmethod
    def add_message(self, message: BaseMessage, raw_message: str = None):
        """
        Append message
        """
        pass

    @abc.abstractmethod
    def delete_message(self, index: int):
        """
        Delete message
        """
        pass

    @abc.abstractmethod
    def delete_reverse_messages(self, index: int = 1):
        """
        Delete last n messages
        """
        pass

    @abc.abstractmethod
    def delete_reverse_message(self, index: int):
        """
        Delete the nth message from the end
        """
        pass

    @abc.abstractmethod
    def update_message(self, index: int, message: BaseMessage):
        """
        Update message
        """
        pass

    @abc.abstractmethod
    def update_reverse_message(self, index: int, message: BaseMessage):
        """
        Update the nth message from the end
        """
        pass

    @abc.abstractmethod
    def get_messages(self, n: int) -> list[BaseMessage]:
        """
        Get the earliest n messages
        """
        pass

    @abc.abstractmethod
    def get_reverse_messages(self, n: int) -> list[BaseMessage]:
        """
        Get the most recent n messages
        """
        pass

    @abc.abstractmethod
    def get_last_message(self) -> BaseMessage:
        """
        Get the last message
        """
        pass

    @abc.abstractmethod
    def get_message_count(self) -> int:
        """
        Get message count
        """
        pass

    @abc.abstractmethod
    def get_all_messages(self) -> list[BaseMessage]:
        """
        Get all messages
        """
        pass

    @abc.abstractmethod
    def get_last_n_user_messages(self) -> list[BaseMessage]:
        """
        Get chat history messages, only return HumanMessage and AIMessage
        """
        pass

    @abc.abstractmethod
    def clear_all_messages(self):
        """
        Clear all messages
        """
        pass

    @abc.abstractmethod
    def cleanup_tool_call_messages(self):
        """
        Clean up AIMessage containing tool_call, delete the last AIMessage containing tool_calls and all messages after it
        """
        pass

    def set_ctx(self, key: str, value):
        """
        Set context information
        """
        self.ctx[key] = value

    def get_ctx(self, key: str, default=None):
        """
        Get context information
        """
        return self.ctx.get(key, default)


class MemorySession(Session):
    """
    In-memory message list for storing messages.
    """

    def __init__(self, session_id: str):
        super().__init__(session_id)
        self.messages: list[BaseMessage] = []
        self.raw_messages: list[str] = []

    def add_message(self, message: BaseMessage, raw_message: str = None):
        if isinstance(message, AIMessage):
            # Check if there are invalid_tool_calls, skip adding if there are
            if hasattr(message, 'invalid_tool_calls') and message.invalid_tool_calls:
                return

        if raw_message is not None:
            message.additional_kwargs["raw_message"] = raw_message
        self.messages.append(message)

    def delete_message(self, index: int):
        if index >= 0 and index < len(self.messages):
            del self.messages[index]

    def update_message(self, index: int, message: BaseMessage):
        if index >= 0 and index < len(self.messages):
            self.messages[index] = message

    def delete_reverse_messages(self, index: int):
        if index <= 0:
            return
        if index >= len(self.messages):
            self.messages = []
        else:
            self.messages = self.messages[:-index]

    def get_last_n_user_messages(self) -> list[BaseMessage]:
        n = self.get_message_count()
        if n <= 0:
            return []
        buf: List[BaseMessage] = []
        last_human_idxs = deque()
        human_seen = 0

        for msg in self.messages:
            buf.append(msg)
            if isinstance(msg, HumanMessage):
                human_seen += 1
                last_human_idxs.append(len(buf) - 1)

                # Only keep the most recent n_humans
                if len(last_human_idxs) > self.n_humans:
                    last_human_idxs.popleft()

                # When Human count > n_humans, trim prefix
                if human_seen > self.n_humans:
                    cut_before = last_human_idxs[0]
                    if cut_before > 0:
                        buf = buf[cut_before:]
                        last_human_idxs = deque(
                            idx - cut_before for idx in last_human_idxs)
        return buf

    def delete_reverse_message(self, index: int):
        # Delete the index-th element from the end
        if index <= 0:
            return
        if index > len(self.messages):
            return  # Cannot delete messages beyond range
        self.messages.pop(-index)

    def update_reverse_message(self, index: int, message: BaseMessage):
        if index <= 0:
            return
        if index > len(self.messages):
            return  # Cannot update messages beyond range
        self.messages[-index] = message

    def get_messages(self, n: int) -> list[BaseMessage]:
        if n <= 0:
            return []
        return self.messages[:n] if len(self.messages) >= n else self.messages[:]

    def get_reverse_messages(self, n: int) -> list[BaseMessage]:
        if n <= 0:
            return []
        return self.messages[-n:] if len(self.messages) >= n else self.messages[:]

    def get_last_message(self) -> BaseMessage:
        if len(self.messages) == 0:
            return None
        return self.messages[-1]

    def get_message_count(self):
        return len(self.messages)

    def get_all_messages(self) -> list[BaseMessage]:
        return self.messages

    def clear_all_messages(self):
        """
        Clear all messages
        """
        self.messages = []

    def cleanup_tool_call_messages(self):
        """
        Clean up AIMessage containing tool_call, search backward from the end for the last AIMessage containing tool_calls
        Delete the last AIMessage containing tool_calls and all messages after it
        """
        # Search backward from the end for the last AIMessage containing tool_calls
        for i in range(len(self.messages) - 1, -1, -1):
            message = self.messages[i]
            if hasattr(message, 'tool_calls') and message.tool_calls:
                # Delete this message and all messages after it
                self.messages = self.messages[:i]
                break


class RedisSession(Session):
    """
    Redis-based message list for storing messages.
    """

    def __init__(self, session_id: str, redis_client: Redis):
        super().__init__(session_id)
        self.redis_client = redis_client

    def set_ctx(self, key: str, value: Any):
        """
        Set context information
        """
        self.redis_client.hset(
            f"session_ctx:{self.session_id}", key, json.dumps(value))

    def get_ctx(self, key: str):
        """
        Get context information
        """
        value = self.redis_client.hget(f"session_ctx:{self.session_id}", key)
        return json.loads(value.decode('utf-8')) if value is not None else None

    # @tracer.start_as_current_span("add_message")
    def add_message(self, message: BaseMessage, raw_message: str = None):
        # span = trace.get_current_span()
        if isinstance(message, AIMessage):
            # Check if there are invalid_tool_calls, skip adding if there are
            if hasattr(message, 'invalid_tool_calls') and message.invalid_tool_calls:
                log(self.session_id, f"add_message skip invalid_tool_calls: {message}",
                    level=LogLevel.ERROR)
                return

        if raw_message is not None:
            # span.set_attribute("message_len", len(raw_message))
            message.additional_kwargs["raw_message"] = raw_message
        serialized = json.dumps(message.to_json())
        self.redis_client.rpush(self.session_id, serialized)

    def delete_message(self, index: int):
        raise NotImplementedError(
            "RedisSession does not support delete_message")

    def delete_reverse_messages(self, index: int = 1):
        raise NotImplementedError(
            "RedisSession does not support delete_reverse_messages")

    def delete_reverse_message(self, index: int):
        """
        Delete the index-th message from the end

        Args:
            index: Which message from the end (1 means last, 2 means second to last)
        """
        if index <= 0:
            return

        # Get current total message count
        total_count = self.redis_client.llen(self.session_id)

        if index > total_count:
            return  # Cannot delete messages beyond range

        try:
            # In Redis, the position of the index-th message from the end is -index
            # Using lrem to delete elements at specific positions is complex, we adopt the following strategy:
            # 1. First get the element to be deleted
            # 2. Then delete the first matching element

            # Get the message to be deleted
            target_message = self.redis_client.lindex(self.session_id, -index)
            if target_message is None:
                return

            # Since Redis lrem deletes by value, it may delete wrong messages (if there are duplicate contents)
            # A safer method is to rebuild the entire list, excluding messages at the target position

            # Get all messages
            all_messages = self.redis_client.lrange(self.session_id, 0, -1)

            # Calculate the position of the message to be deleted in forward index
            delete_pos = total_count - index

            # Delete the entire list
            self.redis_client.delete(self.session_id)

            # Re-add all messages except those at the target position
            for i, message in enumerate(all_messages):
                if i != delete_pos:
                    self.redis_client.rpush(self.session_id, message)

        except Exception as e:
            # If operation fails, log error but don't throw exception
            print(
                f"Warning: Failed to delete reverse message at index {index}: {e}")

    def update_message(self, index: int, message: BaseMessage):
        try:
            # Serialize and store
            serialized = json.dumps(message.to_json())
            self.redis_client.lset(self.session_id, index, serialized)
        except Exception:
            pass  # Ignore when index is out of range

    def update_reverse_message(self, index: int, message: BaseMessage):
        if index <= 0:
            return
        try:
            # Serialize and store
            serialized = json.dumps(message.to_json())
            self.redis_client.lset(self.session_id, -index, serialized)
        except Exception:
            pass  # Ignore when index is out of range

    def get_messages(self, n: int) -> list[BaseMessage]:
        if n <= 0:
            return []
        # Redis returns bytes, need to decode and deserialize to BaseMessage objects
        results = self.redis_client.lrange(self.session_id, 0, n - 1)
        messages = []
        for item in results:
            try:
                # Decode bytes to string
                json_str = item.decode(
                    'utf-8') if isinstance(item, bytes) else str(item)
                # Deserialize to BaseMessage object
                serialized_data = json.loads(json_str)
                message = load(serialized_data)
                messages.append(message)
            except Exception as e:
                # If deserialization fails, skip this message
                print(f"Warning: Failed to deserialize message: {e}")
                continue
        return messages

    def get_reverse_messages(self, n: int) -> list[BaseMessage]:
        if n <= 0:
            return []
        # Redis returns bytes, need to decode and deserialize to BaseMessage objects
        # After using rpush, the newest messages are at the end of the list, so get the last n messages
        results = self.redis_client.lrange(self.session_id, -n, -1)
        messages = []
        for item in results:
            try:
                # Decode bytes to string
                json_str = item.decode(
                    'utf-8') if isinstance(item, bytes) else str(item)
                # Deserialize to BaseMessage object
                serialized_data = json.loads(json_str)
                message = load(serialized_data)
                messages.append(message)
            except Exception as e:
                # If deserialization fails, skip this message
                print(f"Warning: Failed to deserialize message: {e}")
                continue
        return messages

    def get_last_message(self) -> BaseMessage:
        if self.get_message_count() == 0:
            return None
        return self.get_reverse_messages(1)[0]

    def get_message_count(self):
        return self.redis_client.llen(self.session_id)

    def get_all_messages(self) -> list[BaseMessage]:
        return self.get_reverse_messages(self.get_message_count())

    def _deserialize_message(self, item) -> BaseMessage:
        json_str = item.decode(
            "utf-8") if isinstance(item, bytes) else str(item)
        serialized_data = json.loads(json_str)
        return load(serialized_data)

    def get_last_n_user_messages(self) -> list[BaseMessage]:
        """
        Get recent messages, but keep time order, and limit Human message count
        System messages are not counted but are kept
        """
        n: int = self.get_message_count()
        if n <= 0:
            return []

        # Get all messages (from earliest to latest)
        results = self.redis_client.lrange(self.session_id, 0, -1)

        # Calculate the final ignored message index position
        ignore_index = 0

        # Start traversing from the tail, first collect to temporary list
        temp_messages: List[BaseMessage] = []
        human_count = 0
        processed_count = 0  # Record the number of processed messages

        # Reverse traverse messages (from newest to oldest)
        for item in reversed(results):
            try:
                msg = self._deserialize_message(item)
            except Exception as e:
                print(f"Warning: Failed to deserialize message: {e}")
                processed_count += 1
                continue

            # If it's a Human message, check if limit has been reached
            if isinstance(msg, HumanMessage):
                human_count += 1
                if human_count > self.n_humans:
                    # Reached Human message limit, stop collecting
                    # But need to continue traversing remaining messages, keep all System messages

                    # Continue processing remaining messages, only keep System messages
                    remaining_items = list(reversed(results))[processed_count:]
                    system_messages = []

                    for remaining_item in remaining_items:
                        try:
                            remaining_msg = self._deserialize_message(
                                remaining_item)
                            if isinstance(remaining_msg, SystemMessage):
                                system_messages.append(remaining_msg)
                        except Exception as e:
                            print(
                                f"Warning: Failed to deserialize message: {e}")
                            continue

                    # Add System messages to the beginning of results (because we're traversing in reverse)
                    temp_messages.extend(reversed(system_messages))

                    # Calculate the number of ignored messages
                    ignore_index = len(results) - processed_count
                    log(self.session_id,
                        f"Human message limit triggered, ignoring {ignore_index} messages, but keeping {len(system_messages)} System messages",
                        level=LogLevel.DEBUG)
                    break

            # System messages don't participate in Human count statistics, but should be kept
            # Other types of messages (AI, Human, etc.) are processed normally
            temp_messages.append(msg)
            processed_count += 1

        # If not interrupted due to Human limit, it means no messages were ignored
        if human_count <= self.n_humans:
            ignore_index = 0

        # Store ignore_index in instance variable for use by other methods
        self.last_ignore_index = ignore_index
        log(self.session_id, f"last_ignore_index: {ignore_index}",
            level=LogLevel.DEBUG)

        # Reverse temp_messages to restore correct time order
        return list(reversed(temp_messages))

    def clear_all_messages(self):
        """
        Clear all messages
        """
        self.redis_client.delete(self.session_id)

    def cleanup_tool_call_messages(self):
        """
        Clean up AIMessage containing tool_call, search backward from the end for the last AIMessage containing tool_calls
        Delete the last AIMessage containing tool_calls and all messages after it
        """
        # Get all messages
        all_messages = self.get_all_messages()

        # Search backward from the end for the last AIMessage containing tool_calls
        cleanup_index = -1
        for i in range(len(all_messages) - 1, -1, -1):
            message = all_messages[i]
            if hasattr(message, 'tool_calls') and message.tool_calls:
                cleanup_index = i
                break

        if cleanup_index >= 0:
            # Need to rebuild session, only keep messages before cleanup_index
            self.clear_all_messages()
            for i in range(cleanup_index):
                self.add_message(all_messages[i])


class SessionManager:
    """
    Session manager for managing sessions.
    """

    def __init__(self, session_type: type[Session]):
        self.session_type = session_type
        self.sessions: dict[str, Session] = {}

    def get_session(self, session_id: str) -> Session:
        if session_id not in self.sessions:
            if self.session_type == MemorySession:
                self.sessions[session_id] = self.session_type(session_id)
            elif self.session_type == RedisSession:
                print(f"get_redis_env: {get_redis_env()}")
                redis_client = Redis(**get_redis_env())
                self.sessions[session_id] = self.session_type(
                    session_id, redis_client)
            else:
                raise ValueError(f"Invalid session type: {self.session_type}")
        return self.sessions[session_id]


def init_session_manager(session_type: type[Session]) -> SessionManager:
    return SessionManager(session_type)


session_manager = init_session_manager(RedisSession)
