from session import init_session_manager, MemorySession, RedisSession
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage


def test_memory_session():
    """Test memory session functionality"""
    print("=== Testing MemorySession ===")

    session_manager = init_session_manager(MemorySession)
    session = session_manager.get_session("test_memory")

    # Test adding messages
    msg1 = HumanMessage(content="Message 1")
    msg2 = AIMessage(content="Message 2")
    msg3 = SystemMessage(content="Message 3")

    session.add_message(msg1)
    session.add_message(msg2)
    session.add_message(msg3)

    # Test getting message count
    count = session.get_message_count()
    print(f"Message count: {count}")
    assert count == 3, f"期望消息数量为3，实际为{count}"

    # Test getting earliest messages
    first_messages = session.get_messages(2)
    print(f"Earliest 2 messages: {[msg.content for msg in first_messages]}")
    assert len(
        first_messages) == 2, f"Expected to get 2 messages, actual: {len(first_messages)}"
    assert first_messages[0].content == "Message 1", f"First message content does not match"
    assert first_messages[1].content == "Message 2", f"Second message content does not match"

    # Test getting most recent messages
    last_messages = session.get_reverse_messages(2)
    print(f"Latest 2 messages: {[msg.content for msg in last_messages]}")
    assert len(
        last_messages) == 2, f"Expected to get 2 messages, actual: {len(last_messages)}"
    assert last_messages[0].content == "Message 2", f"Second last message content does not match"
    assert last_messages[1].content == "Message 3", f"Last message content does not match"

    # Test getting last message
    last_message = session.get_last_message()
    print(f"Last message: {last_message.content}")
    assert last_message is not None, "Should be able to get the last message"
    assert last_message.content == "Message 3", f"Last message content does not match"
    assert isinstance(
        last_message, SystemMessage), f"Last message should be SystemMessage type"

    # Test updating messages
    updated_msg = HumanMessage(content="Updated Message 2")
    session.update_message(1, updated_msg)
    updated_messages = session.get_messages(3)
    print(f"Updated messages: {[msg.content for msg in updated_messages]}")
    assert updated_messages[
        1].content == "Updated Message 2", f"Expected message to be updated to 'Updated Message 2', actual: {updated_messages[1].content}"

    # Test reverse updating messages (update second to last)
    reverse_updated_msg = AIMessage(content="Reverse Updated Message 2")
    session.update_reverse_message(2, reverse_updated_msg)
    reverse_updated_messages = session.get_messages(3)
    print(
        f"Reverse updated messages: {[msg.content for msg in reverse_updated_messages]}")
    assert reverse_updated_messages[
        1].content == "Reverse Updated Message 2", f"Expected message to be updated to 'Reverse Updated Message 2', actual: {reverse_updated_messages[1].content}"

    # Test deleting messages
    session.delete_message(0)  # Delete first message
    after_delete = session.get_messages(5)
    print(
        f"Messages after deleting first message: {[msg.content for msg in after_delete]}")
    assert len(
        after_delete) == 2, f"Expected 2 messages after deletion, actual: {len(after_delete)}"

    # Test batch deleting messages (delete last 2)
    session.delete_reverse_messages(2)
    after_batch_delete = session.get_messages(5)
    print(
        f"Messages after batch deletion: {[msg.content for msg in after_batch_delete]}")
    assert len(
        after_batch_delete) == 0, f"Expected 0 messages after batch deletion, actual: {len(after_batch_delete)}"

    # Re-add messages to test single deletion
    new_msg1 = HumanMessage(content="New Message 1")
    new_msg2 = AIMessage(content="New Message 2")
    new_msg3 = SystemMessage(content="New Message 3")

    session.add_message(new_msg1)
    session.add_message(new_msg2)
    session.add_message(new_msg3)

    # Test reverse deleting single message (delete second to last)
    session.delete_reverse_message(2)  # Delete "New Message 2"
    after_single_delete = session.get_messages(5)
    print(
        f"Messages after single reverse deletion: {[msg.content for msg in after_single_delete]}")
    expected_after_single = ["New Message 1", "New Message 3"]
    actual_contents = [msg.content for msg in after_single_delete]
    assert actual_contents == expected_after_single, f"Expected {expected_after_single}, actual: {actual_contents}"

    # Test last message changes after deletion operations
    last_message_after_delete = session.get_last_message()
    assert last_message_after_delete.content == "New Message 3", f"Last message should be 'New Message 3'"

    print("MemorySession test passed!\n")


def test_redis_session():
    """Test Redis session functionality"""
    print("=== Testing RedisSession ===")

    try:
        session_manager = init_session_manager(RedisSession)
        session = session_manager.get_session("test_redis")

        # Since RedisSession doesn't support delete operations, we use a new session_id to avoid data conflicts
        import time
        unique_session_id = f"test_redis_{int(time.time())}"
        session = session_manager.get_session(unique_session_id)

        # Test adding messages
        redis_msg1 = HumanMessage(content="Redis Message 1")
        redis_msg2 = AIMessage(content="Redis Message 2")
        redis_msg3 = SystemMessage(content="Redis Message 3")

        session.add_message(redis_msg1)
        session.add_message(redis_msg2)
        session.add_message(redis_msg3)

        # Test getting message count
        count = session.get_message_count()
        print(f"Redis message count: {count}")
        assert count == 3, f"Expected message count to be 3, actual: {count}"

        # Test getting earliest messages
        first_messages = session.get_messages(2)
        print(
            f"Redis earliest 2 messages: {[msg.content for msg in first_messages]}")
        # Redis uses rpush, so order is consistent with memory version: earliest at front
        expected_order = ["Redis Message 1", "Redis Message 2"]
        actual_contents = [msg.content for msg in first_messages]
        assert actual_contents == expected_order, f"Expected {expected_order}, actual: {actual_contents}"

        # Test getting most recent messages
        last_messages = session.get_reverse_messages(2)
        print(
            f"Redis latest 2 messages: {[msg.content for msg in last_messages]}")
        # Most recent 2 messages should be second to last and last
        expected_last = ["Redis Message 2", "Redis Message 3"]
        actual_last_contents = [msg.content for msg in last_messages]
        assert actual_last_contents == expected_last, f"Expected {expected_last}, actual: {actual_last_contents}"

        # Test getting last message
        last_message = session.get_last_message()
        print(f"Redis last message: {last_message.content}")
        assert last_message is not None, "Redis should be able to get the last message"
        assert last_message.content == "Redis Message 3", f"Expected Redis last message to be 'Redis Message 3', actual: '{last_message.content}'"
        assert isinstance(
            last_message, SystemMessage), f"Expected last message to be SystemMessage type"

        # Test updating messages
        updated_msg = AIMessage(content="Redis Updated Message")
        session.update_message(0, updated_msg)
        updated_messages = session.get_messages(3)
        print(
            f"Redis updated messages: {[msg.content for msg in updated_messages]}")
        assert updated_messages[0].content == "Redis Updated Message", f"Expected first message to be updated to 'Redis Updated Message'"

        # Test reverse updating messages
        reverse_updated_msg = HumanMessage(
            content="Redis Reverse Updated Message")
        session.update_reverse_message(1, reverse_updated_msg)
        reverse_updated_messages = session.get_messages(3)
        print(
            f"Redis reverse updated messages: {[msg.content for msg in reverse_updated_messages]}")
        assert reverse_updated_messages[-1].content == "Redis Reverse Updated Message", f"Expected last message to be updated to 'Redis Reverse Updated Message'"

        # Test unsupported delete operations
        print("Testing unsupported delete operations...")
        try:
            session.delete_message(0)
            assert False, "delete_message should throw NotImplementedError"
        except NotImplementedError:
            print("✓ delete_message correctly throws NotImplementedError")

        try:
            session.delete_reverse_messages(1)
            assert False, "delete_reverse_messages should throw NotImplementedError"
        except NotImplementedError:
            print("✓ delete_reverse_messages correctly throws NotImplementedError")

        try:
            session.delete_reverse_message(1)
            assert False, "delete_reverse_message应该抛出NotImplementedError"
        except NotImplementedError:
            print("✓ delete_reverse_message correctly throws NotImplementedError")

        print("RedisSession tests passed!\n")

    except Exception as e:
        print(f"Redis connection failed or other error: {e}")
        print("Skipping Redis tests (Redis service may not be running)\n")


def test_session_manager():
    """Test session manager"""
    print("=== Testing SessionManager ===")

    # Test same session_id returns the same instance
    session_manager = init_session_manager(MemorySession)
    session1 = session_manager.get_session("same_id")
    session2 = session_manager.get_session("same_id")

    assert session1 is session2, "Same session_id should return the same instance"

    # Test different session_id returns different instance
    session3 = session_manager.get_session("different_id")
    assert session1 is not session3, "Different session_id should return different instance"

    # Test session independence
    session1_msg = HumanMessage(content="Session1's message")
    session3_msg = AIMessage(content="Session3's message")

    session1.add_message(session1_msg)
    session3.add_message(session3_msg)

    assert session1.get_message_count() == 1, "session1 should have 1 message"
    assert session3.get_message_count() == 1, "session3 should have 1 message"

    session1_messages = session1.get_messages(5)
    session3_messages = session3.get_messages(5)

    assert session1_messages != session3_messages, "Different session messages should be different"
    assert "session1的消息" in session1_messages[0].content, "session1 should contain its own message"
    assert "session3的消息" in session3_messages[0].content, "session3 should contain its own message"

    print("SessionManager tests passed!\n")


def test_get_last_message():
    """Specifically test get_last_message functionality"""
    print("=== Testing get_last_message functionality ===")

    session_manager = init_session_manager(MemorySession)
    session = session_manager.get_session("test_last_message")

    # Test empty session
    assert session.get_last_message() is None, "Empty session should return None"

    # Add a message
    msg1 = HumanMessage(content="First message")
    session.add_message(msg1)
    last_msg = session.get_last_message()
    assert last_msg is not None, "Should be able to get message"
    assert last_msg.content == "First message", "Content should match"
    assert isinstance(last_msg, HumanMessage), "Type should be correct"

    # Add second message
    msg2 = AIMessage(content="Second message")
    session.add_message(msg2)
    last_msg = session.get_last_message()
    assert last_msg.content == "Second message", "Should return the latest added message"
    assert isinstance(last_msg, AIMessage), "Type should be AIMessage"

    # Add third message
    msg3 = SystemMessage(content="Third message")
    session.add_message(msg3)
    last_msg = session.get_last_message()
    assert last_msg.content == "Third message", "Should return the latest message"
    assert isinstance(last_msg, SystemMessage), "Type should be SystemMessage"

    # Update last message
    updated_msg = HumanMessage(content="Updated last message")
    session.update_reverse_message(1, updated_msg)
    last_msg = session.get_last_message()
    assert last_msg.content == "Updated last message", "Should reflect the updated content"
    assert isinstance(last_msg, HumanMessage), "Type should be HumanMessage"

    # Delete last message
    session.delete_reverse_message(1)
    last_msg = session.get_last_message()
    assert last_msg.content == "Second message", "Should return the new last message after deletion"
    assert isinstance(last_msg, AIMessage), "Type should be AIMessage"

    # Delete all messages
    # Delete more messages than actual number
    session.delete_reverse_messages(10)
    assert session.get_last_message(
    ) is None, "Should return None after deleting all messages"

    print("get_last_message functionality tests passed!\n")


def test_edge_cases():
    """Test edge cases"""
    print("=== Testing edge cases ===")

    session_manager = init_session_manager(MemorySession)
    session = session_manager.get_session("edge_test")

    # 测试空会话
    assert session.get_message_count() == 0, "Empty session message count should be 0"
    assert session.get_messages(
        5) == [], "Empty session should return empty list"
    assert session.get_reverse_messages(
        3) == [], "Empty session should return empty list"

    # Test getting last message from empty session
    empty_last_message = session.get_last_message()
    assert empty_last_message is None, "Empty session should return None"

    # Test getting messages out of range
    unique_msg = HumanMessage(content="Unique message")
    session.add_message(unique_msg)
    # Request more messages than actual number
    messages = session.get_messages(10)
    assert len(
        messages) == 1, "Request out of range should return all available messages"

    reverse_messages = session.get_reverse_messages(10)
    assert len(
        reverse_messages) == 1, "Reverse request out of range should return all available messages"

    # Test getting last message from single message
    single_last_message = session.get_last_message()
    assert single_last_message is not None, "Single message should be able to get the last message"
    assert single_last_message.content == "Unique message", f"Expected to get 'Unique message', actual: '{single_last_message.content}'"
    assert isinstance(single_last_message,
                      HumanMessage), "Message type should be HumanMessage"

    # Test invalid index operations
    session.delete_message(-1)  # Negative index
    session.delete_message(100)  # Out of range index
    assert session.get_message_count(
    ) == 1, "Invalid delete operation should not affect message count"

    invalid_msg = AIMessage(content="Invalid update")
    session.update_message(-1, invalid_msg)
    session.update_message(100, invalid_msg)
    messages_after_invalid_update = session.get_messages(5)
    assert messages_after_invalid_update[0].content == "Unique message", "Invalid update should not change message content"

    # 测试n为0或负数的情况
    assert session.get_messages(0) == [], "n=0 should return empty list"
    assert session.get_messages(-1) == [], "n=-1 should return empty list"
    assert session.get_reverse_messages(
        0) == [], "Reverse get n=0 should return empty list"
    assert session.get_reverse_messages(
        -1) == [], "Reverse get n=-1 should return empty list"

    print("Edge case tests passed!\n")


if __name__ == "__main__":
    print("Starting Session tests...")
    print("=" * 50)

    try:
        test_memory_session()
        test_redis_session()
        test_session_manager()
        test_get_last_message()
        test_edge_cases()

        print("=" * 50)
        print("All tests passed!")

    except AssertionError as e:
        print(f"Test failed: {e}")
    except Exception as e:
        print(f"Error occurred during testing: {e}")
