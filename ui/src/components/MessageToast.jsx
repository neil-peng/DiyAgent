// components/MessageToast.jsx
import React from "react";
import styled from "@emotion/styled";
import { createRoot } from "react-dom/client";

const DEFAULT_DURATION = 1000; // 默认显示时间 (毫秒)
const ANIMATION_DURATION = 300; // 动画持续时间 (毫秒)

const MessageContainer = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  pointer-events: none;
`;

const MessageItem = styled.div`
  border-radius: 4px;
  padding: 1rem 1.5rem;
  margin-bottom: 10px;
  text-align: center;
  min-width: 300px;
  max-width: 500px;
  width: fit-content;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn ${ANIMATION_DURATION}ms ease-out;
  pointer-events: auto;
  opacity: 1;

  ${({ type }) => {
    switch (type) {
      case "success":
        return `
          color: #52c41a;
          background-color: #f6ffed;
          border: 1px solid #b7eb8f;
        `;
      case "error":
        return `
          color: #ff4d4f;
          background-color: #fff2f0;
          border: 1px solid #ffccc7;
        `;
      case "warning":
        return `
          color: #faad14;
          background-color: #fffbe6;
          border: 1px solid #ffe58f;
        `;
      case "info":
      default:
        return `
          color: #1890ff;
          background-color: #e6f7ff;
          border: 1px solid #91d5ff;
        `;
    }
  }}

  &.closing {
    animation: fadeOut ${ANIMATION_DURATION}ms ease-out forwards;
  }

  @keyframes slideIn {
    from {
      transform: translate(0, -100%);
      opacity: 0;
    }
    to {
      transform: translate(0, 0);
      opacity: 1;
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
      transform: translate(0, -100%);
    }
  }
`;

const MessageTitle = styled.div`
  font-weight: bold;
  margin-bottom: 0.5rem;
  ${({ type }) => {
    switch (type) {
      case "success":
        return "color: #52c41a;";
      case "error":
        return "color: #ff4d4f;";
      case "warning":
        return "color: #faad14;";
      case "info":
      default:
        return "color: #1890ff;";
    }
  }}
`;

const MessageContent = styled.div`
  font-size: 0.9rem;
`;

// 消息项组件
const MessageItemComponent = ({
  id,
  type,
  title,
  content,
  isClosing,
  onClose,
}) => {
  const handleAnimationEnd = (e) => {
    // 只在关闭动画结束时触发
    if (isClosing && e.animationName === "fadeOut") {
      onClose(id);
    }
  };

  return (
    <MessageItem
      type={type}
      className={isClosing ? "closing" : ""}
      onAnimationEnd={handleAnimationEnd}
    >
      {title && <MessageTitle type={type}>{title}</MessageTitle>}
      <MessageContent>{content}</MessageContent>
    </MessageItem>
  );
};

// 消息容器组件
const MessageContainerComponent = ({ messages, onClose }) => {
  return (
    <MessageContainer>
      {messages.map((message) => (
        <MessageItemComponent
          key={message.id}
          id={message.id}
          type={message.type}
          title={message.title}
          content={message.content}
          isClosing={message.isClosing}
          onClose={onClose}
        />
      ))}
    </MessageContainer>
  );
};

// 全局消息管理器
class GlobalMessageManager {
  constructor() {
    this.container = null;
    this.root = null;
    this.messages = [];
    this.nextId = 0;
    this.timers = {};
  }

  init() {
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "global-message-container";
      document.body.appendChild(this.container);
      this.root = createRoot(this.container);
    }
  }

  render() {
    if (this.root) {
      this.root.render(
        <MessageContainerComponent
          messages={this.messages}
          onClose={(id) => this.removeMessage(id)}
        />
      );
    }
  }

  addMessage(type, content, title, duration = DEFAULT_DURATION) {
    this.init();

    const id = this.nextId++;
    const message = {
      id,
      type,
      content,
      title,
      isClosing: false,
    };

    this.messages = [...this.messages, message];
    this.render();

    // 设置自动关闭定时器
    this.timers[id] = setTimeout(() => {
      this.closeMessage(id);
    }, duration);

    return id;
  }

  closeMessage(id) {
    // 标记消息为关闭状态以触发动画
    this.messages = this.messages.map((msg) =>
      msg.id === id ? { ...msg, isClosing: true } : msg
    );
    this.render();

    // 清理定时器
    if (this.timers[id]) {
      clearTimeout(this.timers[id]);
      delete this.timers[id];
    }
  }

  removeMessage(id) {
    // 从消息列表中移除
    this.messages = this.messages.filter((msg) => msg.id !== id);
    this.render();

    // 清理定时器
    if (this.timers[id]) {
      clearTimeout(this.timers[id]);
      delete this.timers[id];
    }

    // 如果没有消息了，清理容器
    if (this.messages.length === 0) {
      this.cleanup();
    }
  }

  cleanup() {
    // 清理所有定时器
    Object.keys(this.timers).forEach((id) => {
      clearTimeout(this.timers[id]);
    });
    this.timers = {};

    // 卸载根节点
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    // 移除容器
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  }
}

// 创建全局实例
const messageManager = new GlobalMessageManager();

// 消息API
export const message = {
  success: (content, title, duration) => {
    return messageManager.addMessage("success", content, title, duration);
  },
  error: (content, title, duration) => {
    return messageManager.addMessage("error", content, title, duration);
  },
  warning: (content, title, duration) => {
    return messageManager.addMessage("warning", content, title, duration);
  },
  info: (content, title, duration) => {
    return messageManager.addMessage("info", content, title, duration);
  },
  close: (id) => {
    messageManager.closeMessage(id);
  },
  remove: (id) => {
    messageManager.removeMessage(id);
  },
};

export default message;
