#!/usr/bin/env python3
"""
Session management tool script
To view, manage and operate user sessions

使用方法:
python session_cli.py --help
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
    from session import SessionManager, RedisSession, MemorySession
    from env import get_redis_env
    from redis import Redis
    from langchain_core.messages import BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage
except ImportError as e:
    print(f"导入模块失败: {e}")
    print("请确保在dataui-agent项目目录下运行此脚本")
    sys.exit(1)


class SessionTool:
    """Session management tool class"""

    def __init__(self):
        try:
            # Initialize Redis connection
            self.redis_client = Redis(**get_redis_env())
            # Test connection
            self.redis_client.ping()
            print("✅ Successfully connected to Redis")
        except Exception as e:
            print(f"❌ Failed to connect to Redis: {e}")
            sys.exit(1)

    def list_sessions(self, pattern: str = "*") -> List[str]:
        """Get all session ID list"""
        try:
            # Scan all session keys
            keys = self.redis_client.keys(pattern)

            sessions = []
            for key in keys:
                key_str = key.decode(
                    'utf-8') if isinstance(key, bytes) else key
                # Filter out non-session keys (e.g. user session list)
                if not key_str.startswith('user_sessions:') and not key_str.startswith('session_meta:'):
                    sessions.append(key_str)

            return sorted(sessions)
        except Exception as e:
            print(f"❌ Failed to get session list: {e}")
            return []

    def show_session_detail(self, session_id: str) -> None:
        """Show session details"""
        try:
            # 创建RedisSession实例
            session = RedisSession(session_id, self.redis_client)

            # 获取消息数量
            message_count = session.get_message_count()

            if message_count == 0:
                print(f"❌ Session {session_id} does not exist or is empty")
                return

            print(f"\n🔍 Session details: {session_id}")
            print("=" * 80)

            # 显示基本信息
            print("📊 Session information:")
            info_table = [
                ['Session ID', session_id],
                ['Message count', str(message_count)],
                # Redis Session does not have a direct creation time
                ['Created time', 'N/A'],
                # Redis Session does not have a direct update time
                ['Last updated', 'N/A']
            ]
            print(tabulate(info_table, headers=[
                  'Attribute', 'Value'], tablefmt='simple'))

            # Get all messages
            all_messages = session.get_all_messages()

            if all_messages:
                print(
                    f"\n💬 Message history (total {len(all_messages)} messages):")
                print("-" * 80)

                for i, message in enumerate(all_messages, 1):
                    print(f"\n[{i}] {type(message).__name__}")
                    print("-" * 40)

                    # Use LangChain's pretty_print method
                    if hasattr(message, 'pretty_print'):
                        message.pretty_print()
                    else:
                        # If there is no pretty_print method, use full content display
                        content = str(message.content)

                        # Display different icons based on message type
                        if isinstance(message, HumanMessage):
                            print(f"👤 User:")
                        elif isinstance(message, AIMessage):
                            print(f"🤖 Assistant:")
                        elif isinstance(message, SystemMessage):
                            print(f"⚙️ System:")
                        elif isinstance(message, ToolMessage):
                            print(f"🛠️ Tool result:")
                        else:
                            print(f"📝 Other:")

                        print(content)

                        # If it is an AI message and has tool calls, display tool call information
                        if isinstance(message, AIMessage) and hasattr(message, 'tool_calls') and message.tool_calls:
                            print(f"\n🔧 Tool calls: {len(message.tool_calls)}")
                            for j, tool_call in enumerate(message.tool_calls, 1):
                                print(
                                    f"  {j}. {tool_call.get('name', 'Unknown')} - {tool_call.get('id', 'No ID')}")

                        # If there are additional properties, also display them
                        if hasattr(message, 'additional_kwargs') and message.additional_kwargs:
                            print(
                                f"\n📋 Additional information: {message.additional_kwargs}")
            else:
                print("\n💬 No messages")

        except Exception as e:
            print(f"❌ Failed to get session details: {e}")

    def clear_session(self, session_id: str, confirm: bool = False) -> None:
        """Clear all messages in the session"""
        try:
            # Check if the session exists
            session = RedisSession(session_id, self.redis_client)
            message_count = session.get_message_count()

            if message_count == 0:
                print(f"❌ Session {session_id} does not exist or is empty")
                return

            if not confirm:
                print(f"⚠️  Clearing session:")
                print(f"   Session ID: {session_id}")
                print(f"   Message count: {message_count}")
                response = input("确认清空? (y/N): ").strip().lower()
                if response != 'y':
                    print("❌ Cancel clearing")
                    return

            # 清空会话
            session.clear_all_messages()
            print(f"✅ Successfully cleared session: {session_id}")

        except Exception as e:
            print(f"❌ Failed to clear session: {e}")

    def delete_session(self, session_id: str, confirm: bool = False) -> None:
        """Delete the entire session"""
        try:
            # Check if the session exists
            if not self.redis_client.exists(session_id):
                print(f"❌ Session {session_id} does not exist")
                return

            session = RedisSession(session_id, self.redis_client)
            message_count = session.get_message_count()

            if not confirm:
                print(f"⚠️  Deleting session:")
                print(f"   Session ID: {session_id}")
                print(f"   Message count: {message_count}")
                response = input("确认删除? (y/N): ").strip().lower()
                if response != 'y':
                    print("❌ Cancel deleting")
                    return

            # 删除会话
            self.redis_client.delete(session_id)
            print(f"✅ Successfully deleted session: {session_id}")

        except Exception as e:
            print(f"❌ Failed to delete session: {e}")

    def cleanup_tool_calls(self, session_id: str, confirm: bool = False) -> None:
        """Clean up tool call messages in the session"""
        try:
            # Check if the session exists
            session = RedisSession(session_id, self.redis_client)
            message_count = session.get_message_count()

            if message_count == 0:
                print(f"❌ Session {session_id} does not exist or is empty")
                return

            if not confirm:
                print(f"⚠️  Cleaning up tool call messages in the session:")
                print(f"   Session ID: {session_id}")
                print(f"   Message count: {message_count}")
                response = input("确认清理? (y/N): ").strip().lower()
                if response != 'y':
                    print("❌ Cancel cleaning")
                    return

            # Execute cleanup
            session.cleanup_tool_call_messages()
            new_count = session.get_message_count()
            print(f"✅ Successfully cleaned up tool call messages")
            print(f"   Before cleanup: {message_count} messages")
            print(f"   After cleanup: {new_count} messages")

        except Exception as e:
            print(f"❌ Failed to clean up tool call messages: {e}")

    def show_session_stats(self, session_id: str) -> None:
        """Show session statistics"""
        try:
            session = RedisSession(session_id, self.redis_client)
            message_count = session.get_message_count()

            if message_count == 0:
                print(f"❌ Session {session_id} does not exist or is empty")
                return

            # Get all messages and count them
            all_messages = session.get_all_messages()

            stats = {
                'total': len(all_messages),
                'human': 0,
                'ai': 0,
                'system': 0,
                'tool': 0,
                'tool_calls': 0
            }

            for message in all_messages:
                if isinstance(message, HumanMessage):
                    stats['human'] += 1
                elif isinstance(message, AIMessage):
                    stats['ai'] += 1
                    if hasattr(message, 'tool_calls') and message.tool_calls:
                        stats['tool_calls'] += len(message.tool_calls)
                elif isinstance(message, SystemMessage):
                    stats['system'] += 1
                elif isinstance(message, ToolMessage):
                    stats['tool'] += 1

            print(f"\n📊 Session statistics: {session_id}")
            print("=" * 50)

            stats_table = [
                ['Total messages', stats['total']],
                ['User messages', stats['human']],
                ['Assistant messages', stats['ai']],
                ['System messages', stats['system']],
                ['Tool messages', stats['tool']],
                ['Tool calls', stats['tool_calls']]
            ]

            print(tabulate(stats_table, headers=[
                  'Type', 'Count'], tablefmt='simple'))

        except Exception as e:
            print(f"❌ Failed to get session statistics: {e}")

    def search_sessions(self, keyword: str) -> None:
        """Search for sessions containing the keyword"""
        try:
            sessions = self.list_sessions()
            found_sessions = []

            for session_id in sessions:
                try:
                    session = RedisSession(session_id, self.redis_client)
                    messages = session.get_all_messages()

                    # 在消息内容中搜索关键词
                    for message in messages:
                        content = str(message.content).lower()
                        if keyword.lower() in content:
                            found_sessions.append({
                                'session_id': session_id,
                                'message_count': len(messages)
                            })
                            break

                except Exception:
                    continue  # 跳过有问题的会话

            if not found_sessions:
                print(f"❌ No sessions found containing keyword '{keyword}'")
                return

            print(
                f"\n🔍 Search results: found {len(found_sessions)} sessions containing keyword '{keyword}'")
            print("=" * 80)

            # Show search results
            table_data = []
            for session_info in found_sessions:
                table_data.append([
                    session_info['session_id'][:50] + '...' if len(
                        session_info['session_id']) > 50 else session_info['session_id'],
                    session_info['message_count']
                ])

            headers = ['Session ID', 'Messages']
            print(tabulate(table_data, headers=headers, tablefmt='grid'))

        except Exception as e:
            print(f"❌ Failed to search: {e}")


def main():
    parser = argparse.ArgumentParser(description='Session management tool')
    subparsers = parser.add_subparsers(
        dest='command', help='Available commands')

    # List all sessions
    list_parser = subparsers.add_parser('list', help='List all sessions')
    list_parser.add_argument('--pattern', default='*',
                             help='Session ID matching pattern')

    # Show session details
    detail_parser = subparsers.add_parser(
        'detail', help='Show session details')
    detail_parser.add_argument('session_id', help='Session ID')

    # Show session statistics
    stats_parser = subparsers.add_parser(
        'stats', help='Show session statistics')
    stats_parser.add_argument('session_id', help='Session ID')

    # Clear all messages in the session
    clear_parser = subparsers.add_parser(
        'clear', help='Clear all messages in the session')
    clear_parser.add_argument('session_id', help='会话ID')
    clear_parser.add_argument(
        '--yes', action='store_true', help='Skip confirmation')

    # Delete the entire session
    delete_parser = subparsers.add_parser(
        'delete', help='Delete the entire session')
    delete_parser.add_argument('session_id', help='Session ID')
    delete_parser.add_argument(
        '--yes', action='store_true', help='Skip confirmation')

    # Clean up tool call messages in the session
    cleanup_parser = subparsers.add_parser(
        'cleanup-tools', help='Clean up tool call messages in the session')
    cleanup_parser.add_argument('session_id', help='Session ID')
    cleanup_parser.add_argument(
        '--yes', action='store_true', help='Skip confirmation')

    # Search for sessions containing the keyword
    search_parser = subparsers.add_parser(
        'search', help='Search for sessions containing the keyword')
    search_parser.add_argument('keyword', help='Search keyword')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Initialize tool
    tool = SessionTool()

    # Execute command
    try:
        if args.command == 'list':
            sessions = tool.list_sessions(args.pattern)
            if sessions:
                print(f"\n📋 Found {len(sessions)} sessions:")
                for i, session_id in enumerate(sessions, 1):
                    print(f"  {i}. {session_id}")
            else:
                print("❌ No sessions found")

        elif args.command == 'detail':
            tool.show_session_detail(args.session_id)

        elif args.command == 'stats':
            tool.show_session_stats(args.session_id)

        elif args.command == 'clear':
            tool.clear_session(args.session_id, args.yes)

        elif args.command == 'delete':
            tool.delete_session(args.session_id, args.yes)

        elif args.command == 'cleanup-tools':
            tool.cleanup_tool_calls(args.session_id, args.yes)

        elif args.command == 'search':
            tool.search_sessions(args.keyword)

    except KeyboardInterrupt:
        print("\n\n❌ Operation interrupted by user")
    except Exception as e:
        print(f"\n❌ Error occurred while executing command: {e}")


if __name__ == '__main__':
    main()
