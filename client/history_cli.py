#!/usr/bin/env python3
"""
History management tool script
To view, manage and operate user session history records

Usage:
python history_cli.py --help
"""

import argparse
import sys
import os
import json
from datetime import datetime
from typing import List, Optional
from tabulate import tabulate

# Add project path to sys.path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

try:
    from history import HistoryManager
    from env import get_redis_env
except ImportError as e:
    print(f"Failed to import module: {e}")
    print("Please ensure the script is run in the dataui-agent project directory")
    sys.exit(1)


class HistoryTool:
    """History management tool class"""

    def __init__(self):
        try:
            self.history_manager = HistoryManager()
            print("✅ Successfully connected to Redis")
        except Exception as e:
            print(f"❌ Failed to connect to Redis: {e}")
            sys.exit(1)

    def list_users(self) -> List[str]:
        """Get all users with sessions"""
        try:
            # Scan all user session keys
            pattern = f"{self.history_manager.user_sessions_prefix}*"
            keys = self.history_manager.redis.keys(pattern)

            users = []
            for key in keys:
                key_str = key.decode(
                    'utf-8') if isinstance(key, bytes) else key
                user_id = key_str.replace(
                    self.history_manager.user_sessions_prefix, '')
                if user_id:
                    users.append(user_id)

            return sorted(users)
        except Exception as e:
            print(f"❌ Failed to get user list: {e}")
            return []

    def show_user_sessions(self, user_id: str, limit: int = 20) -> None:
        """Show all sessions for a user"""
        try:
            sessions = self.history_manager.get_user_sessions_with_meta(
                user_id, limit)

            if not sessions:
                print(f"User {user_id} has no session records")
                return

            print(
                f"\n📋 User {user_id} sessions (total {len(sessions)} sessions):")
            print("=" * 80)

            # Prepare table data
            table_data = []
            for session in sessions:
                table_data.append([
                    session['session_id'],
                    session['title'][:30] +
                    '...' if len(session['title']
                                 ) > 30 else session['title'],
                    session.get(
                        'created_at', 'N/A')[:19] if session.get('created_at') else 'N/A',
                    session.get(
                        'updated_at', 'N/A')[:19] if session.get('updated_at') else 'N/A'
                ])

            headers = ['Session ID', 'Title', 'Created', 'Updated']
            print(tabulate(table_data, headers=headers, tablefmt='grid'))

        except Exception as e:
            print(f"❌ Failed to get user sessions: {e}")

    def show_session_detail(self, session_id: str) -> None:
        """Show session details"""
        try:
            # Get session metadata
            meta = self.history_manager.get_session_meta(session_id)
            if not meta:
                print(
                    f"❌ Session {session_id} does not exist or has no metadata")
                return

            # Get session history
            history = self.history_manager.get_session_history(
                session_id, limit=100)

            print(f"\n🔍 Session details: {session_id}")
            print("=" * 80)

            # 显示元数据
            print("📊 Session metadata:")
            meta_table = [
                ['Title', meta.get('title', 'N/A')],
                ['User ID', meta.get('user_id', 'N/A')],
                ['Created at', meta.get('created_at', 'N/A')],
                ['Updated at', meta.get('updated_at', 'N/A')],
                ['Interaction count', str(len(history))]
            ]
            print(tabulate(meta_table, headers=[
                  'Attribute', 'Value'], tablefmt='simple'))

            # Show history
            if history:
                print(f"\n💬 History (last {len(history)} interactions):")
                print("-" * 80)

                for i, interaction in enumerate(history, 1):
                    timestamp = interaction.get('timestamp', 'N/A')
                    user_input = interaction.get('user_input', '')
                    agent_responses = interaction.get('agent_responses', [])

                    print(f"\n[{i}] {timestamp}")
                    print(f"👤 User: {user_input}")
                    if agent_responses:
                        response_text = ' '.join(agent_responses) if isinstance(
                            agent_responses, list) else str(agent_responses)
                        # Truncate long responses
                        if len(response_text) > 200:
                            response_text = response_text[:200] + "..."
                        print(f"🤖 Assistant: {response_text}")
            else:
                print("\n💬 No history")

        except Exception as e:
            print(f"❌ Failed to get session details: {e}")

    def update_session_title(self, session_id: str, new_title: str) -> None:
        """Update session title"""
        try:
            # Check if session exists
            meta = self.history_manager.get_session_meta(session_id)
            if not meta:
                print(f"❌ Session {session_id} does not exist")
                return

            # Update title
            self.history_manager.update_session_title(session_id, new_title)
            print(f"✅ Successfully updated session title: {new_title}")

        except Exception as e:
            print(f"❌ Failed to update session title: {e}")

    def delete_session(self, session_id: str, confirm: bool = False) -> None:
        """Delete session"""
        try:
            # Check if session exists (check history and metadata)
            meta = self.history_manager.get_session_meta(session_id)
            history = self.history_manager.get_session_history(
                session_id, limit=1)

            # If there is no metadata and no history, the session does not exist
            if not meta and not history:
                print(f"❌ Session {session_id} does not exist")
                return

            # Get session information for display
            user_id = meta.get('user_id') if meta else None
            title = meta.get('title', 'N/A') if meta else 'N/A'

            # If there is no metadata but there is history, try to find the user ID from the user session list
            if not user_id:
                users = self.list_users()
                for uid in users:
                    user_sessions = self.history_manager.get_user_sessions(uid)
                    if session_id in user_sessions:
                        user_id = uid
                        break

            if not confirm:
                print(f"⚠️  Deleting session:")
                print(f"   Session ID: {session_id}")
                print(f"   Title: {title}")
                print(f"   User ID: {user_id or 'N/A'}")
                print(f"   History: {'Yes' if history else 'No'}")
                print(f"   Metadata: {'Yes' if meta else 'No'}")
                response = input("Confirm deletion? (y/N): ").strip().lower()
                if response != 'y':
                    print("❌ Cancel deletion")
                    return

            # Delete session history
            history_deleted = self.history_manager.clear_session_history(
                session_id)

            # Remove from user session list
            if user_id:
                self.history_manager.remove_user_session(user_id, session_id)

            print(f"✅ Successfully deleted session: {session_id}")
            if history_deleted:
                print("   - History deleted")
            if meta:
                print("   - Metadata deleted")

        except Exception as e:
            print(f"❌ Failed to delete session: {e}")

    def delete_user_sessions(self, user_id: str, confirm: bool = False) -> None:
        """Delete all sessions for a user"""
        try:
            sessions = self.history_manager.get_user_sessions_with_meta(
                user_id)
            if not sessions:
                print(f"❌ User {user_id} has no session records")
                return

            if not confirm:
                print(
                    f"⚠️  Deleting all {len(sessions)} sessions for user {user_id}")
                response = input("Confirm deletion? (y/N): ").strip().lower()
                if response != 'y':
                    print("❌ Cancel deletion")
                    return

            # Delete all sessions
            for session in sessions:
                session_id = session['session_id']
                self.history_manager.clear_session_history(session_id)

            # Clear user session list
            self.history_manager.clear_user_sessions(user_id)

            print(f"✅ Successfully deleted all sessions for user {user_id}")

        except Exception as e:
            print(f"❌ Failed to delete user sessions: {e}")

    def search_sessions(self, keyword: str, user_id: Optional[str] = None) -> None:
        """Search for sessions containing a keyword"""
        try:
            users_to_search = [user_id] if user_id else self.list_users()
            found_sessions = []

            for uid in users_to_search:
                sessions = self.history_manager.get_user_sessions_with_meta(
                    uid)
                for session in sessions:
                    # Search in title
                    if keyword.lower() in session['title'].lower():
                        found_sessions.append(session)
                        continue

                    # Search in history
                    history = self.history_manager.get_session_history(
                        session['session_id'], limit=10)
                    for interaction in history:
                        user_input = interaction.get('user_input', '')
                        agent_responses = interaction.get(
                            'agent_responses', [])
                        response_text = ' '.join(agent_responses) if isinstance(
                            agent_responses, list) else str(agent_responses)

                        if (keyword.lower() in user_input.lower() or
                                keyword.lower() in response_text.lower()):
                            found_sessions.append(session)
                            break

            if not found_sessions:
                print(f"❌ No sessions found containing keyword '{keyword}'")
                return

            print(
                f"\n🔍 Search results: found {len(found_sessions)} sessions containing keyword '{keyword}'")
            print("=" * 80)

            # Show search results
            table_data = []
            for session in found_sessions:
                table_data.append([
                    session['session_id'][:20] +
                    '...' if len(session['session_id']
                                 ) > 20 else session['session_id'],
                    session['title'][:30] +
                    '...' if len(session['title']
                                 ) > 30 else session['title'],
                    session.get('user_id', 'N/A'),
                    session.get(
                        'updated_at', 'N/A')[:19] if session.get('updated_at') else 'N/A'
                ])

            headers = ['Session ID', 'Title', 'User ID', 'Updated']
            print(tabulate(table_data, headers=headers, tablefmt='grid'))

        except Exception as e:
            print(f"❌ Failed to search: {e}")


def main():
    parser = argparse.ArgumentParser(description='History management tool')
    subparsers = parser.add_subparsers(
        dest='command', help='Available commands')

    # List all users
    subparsers.add_parser('users', help='List all users with sessions')

    # List user sessions
    user_parser = subparsers.add_parser('sessions', help='List user sessions')
    user_parser.add_argument('user_id', help='User ID')
    user_parser.add_argument(
        '--limit', type=int, default=20, help='Limit number of sessions')

    # Show session details
    detail_parser = subparsers.add_parser(
        'detail', help='Show session details')
    detail_parser.add_argument('session_id', help='Session ID')

    # Update session title
    update_parser = subparsers.add_parser(
        'update-title', help='Update session title')
    update_parser.add_argument('session_id', help='Session ID')
    update_parser.add_argument('title', help='New title')

    # Delete session
    delete_parser = subparsers.add_parser(
        'delete-session', help='Delete specified session')
    delete_parser.add_argument('session_id', help='Session ID')
    delete_parser.add_argument(
        '--yes', action='store_true', help='Skip confirmation')

    # 删除用户所有会话
    delete_user_parser = subparsers.add_parser(
        'delete-user', help='Delete all sessions for a user')
    delete_user_parser.add_argument('user_id', help='User ID')
    delete_user_parser.add_argument(
        '--yes', action='store_true', help='Skip confirmation')

    # Search sessions
    search_parser = subparsers.add_parser(
        'search', help='Search sessions containing a keyword')
    search_parser.add_argument('keyword', help='Search keyword')
    search_parser.add_argument('--user', help='Limit search to specified user')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Initialize tool
    tool = HistoryTool()

    # Execute command
    try:
        if args.command == 'users':
            users = tool.list_users()
            if users:
                print(f"\n👥 Found {len(users)} users:")
                for i, user in enumerate(users, 1):
                    print(f"  {i}. {user}")
            else:
                print("❌ No users found")

        elif args.command == 'sessions':
            tool.show_user_sessions(args.user_id, args.limit)

        elif args.command == 'detail':
            tool.show_session_detail(args.session_id)

        elif args.command == 'update-title':
            tool.update_session_title(args.session_id, args.title)

        elif args.command == 'delete-session':
            tool.delete_session(args.session_id, args.yes)

        elif args.command == 'delete-user':
            tool.delete_user_sessions(args.user_id, args.yes)

        elif args.command == 'search':
            tool.search_sessions(args.keyword, args.user)

    except KeyboardInterrupt:
        print("\n\n❌ Operation interrupted by user")
    except Exception as e:
        print(f"\n❌ Error occurred while executing command: {e}")


if __name__ == '__main__':
    main()
