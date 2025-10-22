import React, { useContext, useRef, useEffect } from "react";
import styled from "@emotion/styled";
import { motion, AnimatePresence } from "framer-motion";
import MessageInput from "./MessageInput";
import Message from "./Message";
import WelcomePage from "./WelcomePage";
import { ChatContext } from "../context/ChatContext";

const Container = styled.div`
  width: 100%;
  max-width: 1500px;
  margin: 0;
  background: white;
  border-radius: 0px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const ChatWindow = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
  width: 100%;
  max-width: 1000px;
  background: white;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  &::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 3px;
  }
`;

const StarsContainer = styled(motion.div)`
  margin: 1rem auto;
  display: inline-flex;
  align-items: center;
  justify-content: space-around;
  padding: 6px 12px;
  width: 100px;
`;

const Star = styled.span`
  font-size: 14px;
  color: #4caf50;
  filter: drop-shadow(0 0 2px rgba(76, 175, 80, 0.4));
  display: inline-block;

  &:nth-child(1) {
    animation: twinkle 1.4s infinite 0s;
  }
  &:nth-child(2) {
    animation: twinkle 1.4s infinite 0.3s;
  }
  &:nth-child(3) {
    animation: twinkle 1.4s infinite 0.6s;
  }

  @keyframes twinkle {
    0% {
      transform: scale(1) rotate(0deg);
      opacity: 1;
      color: #00e092;
    }
    100% {
      transform: scale(0.8) rotate(0deg);
      opacity: 1;
      color: #aa78ff;
    }
    50% {
      transform: scale(1.2) rotate(20deg);
      opacity: 1;
      color: #5cb1ff;
    }
  }
`;

const ControlBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0rem 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  font-size: 0.85rem;
  color: #6c757d;
`;

const RefreshButton = styled.button`
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.75rem;
  color: #6c757d;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;

  &:hover {
    background: #e9ecef;
    border-color: #adb5bd;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const MessageCount = styled.span`
  font-size: 0.75rem;
  color: #868e96;
`;

const ChatInterface = () => {
  const {
    messages,
    isLoading,
    streamingMessageId,
    loadChatHistory,
    sendMessage,
  } = useContext(ChatContext);
  const messagesEndRef = useRef(null);
  const chatWindowRef = useRef(null);

  // 检测是否有流式消息正在更新
  const hasStreamingMessage = messages.some((msg) => msg.isStreaming);

  // 强制检查加载状态，确保星星正确消失
  const shouldShowStars = isLoading && !hasStreamingMessage;


  // 监听消息变化和流式更新，自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // 监听流式消息内容变化，触发滚动
  useEffect(() => {
    if (streamingMessageId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamingMessageId, messages]);

  // 监听内容变化，保持滚动在底部
  useEffect(() => {
    const chatWindow = chatWindowRef.current;
    if (!chatWindow) return;

    // 检查消息内容是否有变化
    const handleContentChange = (mutationsList) => {
      for (const mutation of mutationsList) {
        if (
          mutation.type === "childList" ||
          mutation.type === "characterData"
        ) {
          // 检查是否接近底部，如果是则滚动到底部
          const { scrollTop, scrollHeight, clientHeight } = chatWindow;
          const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

          if (isNearBottom || hasStreamingMessage) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }
        }
      }
    };

    // 创建观察器
    const observer = new MutationObserver(handleContentChange);

    // 观察内容变化
    observer.observe(chatWindow, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [hasStreamingMessage]);

  // 额外的安全机制：监听加载状态和流式消息状态，确保星星正确消失
  useEffect(() => {
    if (!isLoading && !hasStreamingMessage) {
      // 当既不在加载也没有流式消息时，确保没有遗留的状态问题
      console.log(
        "Loading completed, ensuring all streaming states are cleared"
      );
    }
  }, [isLoading, hasStreamingMessage]);

  return (
    <Container>
      <ChatWindow ref={chatWindowRef}>
        {messages.length === 0 && !isLoading ? (
          // 没有消息且不在加载状态时显示欢迎页
          <WelcomePage
            onExampleClick={async (example) => {
              // 直接发送示例消息
              console.log("user clicked example, automatically sending:", example);
              try {
                await sendMessage(example);
                console.log("example message sent successfully");
              } catch (error) {
                console.error("failed to send example message:", error);
              }
            }}
          />
        ) : (
          // 有消息时显示消息列表
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={message.id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Message
                  message={message}
                  messageId={message.id || `msg-${index}`}
                />
              </motion.div>
            ))}
            {/* 当没有流式消息时才显示加载指示器 */}
            {shouldShowStars && (
              <motion.div
                key="loading-stars"
                style={{ textAlign: "center", width: "100%" }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <StarsContainer>
                  <Star>●</Star>
                  <Star>●</Star>
                  <Star>●</Star>
                </StarsContainer>
              </motion.div>
            )}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </ChatWindow>
      <MessageInput />
    </Container>
  );
};

export default ChatInterface;
