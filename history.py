from typing import List
from redis import Redis
from env import get_redis_env
import json
from datetime import datetime
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

quick_llm = ChatOpenAI(model="qwen-turbo-latest",
                       base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", extra_body={"enable_thinking": False})


class HistoryManager:
    """History record manager"""

    def __init__(self, redis_client: Redis = None):
        self.redis = redis_client or Redis(**get_redis_env())
        self.history_prefix = "session_history:"
        self.user_sessions_prefix = "user_sessions:"  # New: user session list prefix
        self.session_meta_prefix = "session_meta:"  # New: session metadata prefix

    def save_interaction(self, session_id: str, user_input: str, agent_responses: List[str], user_id: str = None):
        """Save a complete interaction (user input + agent response)"""
        interaction_data = {
            "user_input": user_input,
            "agent_responses": agent_responses,
            "timestamp": datetime.now().isoformat()
        }

        history_key = f"{self.history_prefix}{session_id}"
        self.redis.rpush(history_key, json.dumps(interaction_data))

        # If user_id is provided, update the position of this session in user session list (move to front)
        if user_id:
            self.add_user_session(user_id, session_id)

            # Check if session has title, generate if not
            if not self.get_session_title(session_id):
                self._generate_and_save_title(
                    session_id, user_input, agent_responses, user_id)

    def get_session_history(self, session_id: str, limit: int = 50) -> List[dict]:
        """Get session history records"""
        history_key = f"{self.history_prefix}{session_id}"
        results = self.redis.lrange(history_key, -limit, -1)

        history = []
        for item in results:
            try:
                data = json.loads(item.decode('utf-8'))
                history.append(data)
            except Exception as e:
                print(f"Failed to parse history item: {e}")

        return history

    def clear_session_history(self, session_id: str) -> bool:
        """Clear session history records and metadata"""
        history_key = f"{self.history_prefix}{session_id}"
        history_deleted = self.redis.delete(history_key) > 0

        # Also delete metadata
        self.delete_session_meta(session_id)

        return history_deleted

    def add_user_session(self, user_id: str, session_id: str, max_sessions: int = 20):
        """Add session ID to user's session list, maintain the most recent max_sessions sessions"""
        if not user_id or not session_id:
            return

        user_sessions_key = f"{self.user_sessions_prefix}{user_id}"

        # Check if session ID already exists and its position
        existing_sessions = self.redis.lrange(user_sessions_key, 0, -1)
        existing_sessions_str = [s.decode('utf-8') for s in existing_sessions]

        if existing_sessions_str and existing_sessions_str[0] == session_id:
            # If session is already at the front, no operation needed
            return

        if session_id in existing_sessions_str:
            # If session exists but not at front, remove it first (will be added to front later)
            self.redis.lrem(user_sessions_key, 0, session_id)

        # Add session to the front of the list (newest)
        self.redis.lpush(user_sessions_key, session_id)

        # Keep list length not exceeding max_sessions, delete oldest sessions
        current_length = self.redis.llen(user_sessions_key)
        if current_length > max_sessions:
            # Delete oldest sessions exceeding limit
            self.redis.ltrim(user_sessions_key, 0, max_sessions - 1)

    def get_user_sessions(self, user_id: str, limit: int = 100) -> List[str]:
        """Get all user session ID list (sorted from newest to oldest)"""
        if not user_id:
            return []

        user_sessions_key = f"{self.user_sessions_prefix}{user_id}"
        # Get newest sessions from the beginning of the list (because we use lpush to add to front)
        results = self.redis.lrange(user_sessions_key, 0, limit - 1)

        return [item.decode('utf-8') for item in results]

    def remove_user_session(self, user_id: str, session_id: str):
        """Remove specified session ID from user session list and clean metadata"""
        if not user_id or not session_id:
            return

        user_sessions_key = f"{self.user_sessions_prefix}{user_id}"
        self.redis.lrem(user_sessions_key, 0, session_id)

        # Also delete session metadata
        self.delete_session_meta(session_id)

    def clear_user_sessions(self, user_id: str) -> bool:
        """Clear all user session records"""
        if not user_id:
            return False

        user_sessions_key = f"{self.user_sessions_prefix}{user_id}"
        return self.redis.delete(user_sessions_key) > 0

    def _generate_and_save_title(self, session_id: str, user_input: str, agent_responses: List[str], user_id: str):
        """Generate and save session title based on conversation content"""
        try:
            # Build prompt for generating title
            conversation_text = f"User: {user_input}\nAssistant: {' '.join(agent_responses)}"

            title_prompt = f"""
Please generate a concise conversation title (no more than 20 characters) based on the following conversation content:

Conversation content:
{conversation_text}

Requirements:
1. Title should be concise and clear, able to summarize the conversation topic
2. No more than 20 characters
3. Only return the title text, no other content
"""

            messages = [
                SystemMessage(
                    content="You are a professional conversation title generation assistant."),
                HumanMessage(content=title_prompt)
            ]

            # Call LLM to generate title
            response = quick_llm.invoke(messages)
            title = response.content.strip()

            # Ensure title length does not exceed limit
            if len(title) > 20:
                title = title[:17] + "..."

            # Save title
            self.save_session_meta(session_id, title=title, user_id=user_id)

        except Exception as e:
            print(f"Error generating title for session {session_id}: {e}")
            # If generation fails, use default title
            default_title = f"Conversation {datetime.now().strftime('%m-%d %H:%M')}"
            self.save_session_meta(
                session_id, title=default_title, user_id=user_id)

    def save_session_meta(self, session_id: str, title: str = None, user_id: str = None):
        """Save session metadata"""
        meta_key = f"{self.session_meta_prefix}{session_id}"

        # Get existing metadata
        existing_meta = self.get_session_meta(session_id)

        # Update metadata
        meta_data = {
            "title": title or existing_meta.get("title"),
            "user_id": user_id or existing_meta.get("user_id"),
            "created_at": existing_meta.get("created_at") or datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }

        # Remove None values
        meta_data = {k: v for k, v in meta_data.items() if v is not None}

        self.redis.hset(meta_key, mapping=meta_data)

    def get_session_meta(self, session_id: str) -> dict:
        """Get session metadata"""
        meta_key = f"{self.session_meta_prefix}{session_id}"
        meta_data = self.redis.hgetall(meta_key)

        # Convert bytes to string
        return {k.decode('utf-8'): v.decode('utf-8') for k, v in meta_data.items()}

    def get_session_title(self, session_id: str) -> str:
        """Get session title"""
        meta = self.get_session_meta(session_id)
        return meta.get("title")

    def update_session_title(self, session_id: str, title: str):
        """Update session title"""
        meta_key = f"{self.session_meta_prefix}{session_id}"
        self.redis.hset(meta_key, "title", title)
        self.redis.hset(meta_key, "updated_at", datetime.now().isoformat())

    def get_user_sessions_with_meta(self, user_id: str, limit: int = 100) -> List[dict]:
        """Get all user session ID list and their metadata (sorted from newest to oldest)"""
        if not user_id:
            return []

        session_ids = self.get_user_sessions(user_id, limit)
        sessions_with_meta = []

        for session_id in session_ids:
            meta = self.get_session_meta(session_id)
            sessions_with_meta.append({
                "session_id": session_id,
                "title": meta.get("title", f"Session {session_id[:8]}..."),
                "user_id": meta.get("user_id"),
                "created_at": meta.get("created_at"),
                "updated_at": meta.get("updated_at")
            })

        return sessions_with_meta

    def delete_session_meta(self, session_id: str):
        """Delete session metadata"""
        meta_key = f"{self.session_meta_prefix}{session_id}"
        self.redis.delete(meta_key)


# Global history manager instance
history_manager = HistoryManager()
