import React, { useState, useContext, useRef, useEffect } from "react";
import styled from "@emotion/styled";
import { ChatContext } from "../context/ChatContext";
import { message } from "../components/MessageToast";

import aisend from "../assets/aisend.svg";
import aistop from "../assets/aistop.svg";

import { ReactComponent as FlashAutoIcon } from "../assets/flash_auto.svg";
import { ReactComponent as AiVoiceIcon } from "../assets/aivoice.svg";
import { ReactComponent as AiSend } from "../assets/aisend.svg";
import { ReactComponent as AiStop } from "../assets/aistop.svg";
import Tooltip from "./Tooltip";

const InputContainer = styled.div`
  display: flex;
  position: relative;
  flex-direction: column;
  gap: 0.5rem;
  height: 130px;
  padding-bottom: 28px;
  padding-left: 28px;
  padding-right: 28px;
  max-width: 790px;
  min-width: 324px;
  width: 100%;
`;

const InputControls = styled.div`
  display: flex;
  width: 100%;
  height: 130px;
  border-radius: 16px;
  background: linear-gradient(white, white) padding-box,
    linear-gradient(81deg, #00e092, #5cb1ff, #b978ff, #3278ff) border-box;
  border: 2px solid transparent; /* 必须透明 */
  &:focus-within {
    outline: none;
    background: linear-gradient(white, white) padding-box,
      linear-gradient(81deg, #3278ff, #5cb1ff, #b978ff, #00e092) border-box;
  }
`;

const TextArea = styled.textarea`
  flex: 1;
  padding: 0.6rem;
  margin-right: 0.6rem;
  margin-top: 0.1rem;
  resize: none;
  font-size: 0.9rem;
  line-height: 1.1rem;
  height: 60px;
  min-height: 36px;
  max-height: 120px;
  overflow-y: auto;
  border: none;
  border-radius: 16px;
  &:focus {
    outline: none;
    border: none;
  }
  font-family: -apple-system, BlinkMacSystemFont, PingFang SC,
    Source Han Sans SC, Helvetica Neue, Helvetica, Roboto, Arial,
    Hiragino Sans GB, Segoe UI, Microsoft YaHei, sans-serif;
`;

const SendDiv = styled.div`
  position: absolute;
  bottom: 35px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  width: 100%;
  height: 32px;
  margin-right: 28px;
`;

const SendLeftDiv = styled.div`
  display: flex;
  align-items: center;
`;

const SendRightDiv = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: right;
  column-gap: 5px;
  margin-right: 54px;
`;
const SendFileUpload = styled.div`
  width: 32px;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
`;
const SendVoiceInput = styled.div`
  width: 32px;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 8px;

  &:hover {
    background: #f0f3fa;
  }
`;

const SendAutoExecute = styled.div`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  &:hover {
    background: #f0f3fa;
  }
`;

const SendButton = styled.div`
  width: 32px;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    pointer-events: none;
  }
  ${({ disabled, isLoading }) => {
    if (disabled && isLoading) {
      return `
        &:hover {
            background: #f0f3fa;
        },
        &:active {
            background: #dee8ff;
        }
      `;
    }
  }}
`;

const SendButton1111 = styled.button`
  padding: 0 1.5rem;
  min-height: 36px;
  max-height: 120px;
  min-width: 80px;
  background: #007aff;
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #0066cc;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const LoadingDots = styled.span`
  &::after {
    display: inline-block;
    animation: ellipsis 1.25s infinite;
    content: ".";
    width: 1em;
    text-align: left;
  }

  @keyframes ellipsis {
    0% {
      content: ".";
    }
    33% {
      content: "..";
    }
    66% {
      content: "...";
    }
  }
`;

const SendButtonText = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const AutoExecuteButton = styled.button`
  width: 80px;
  height: 32px;
  border: 1px solid ${(props) => (props.active ? "#4caf50" : "#e1e1e1")};
  border-radius: 6px;
  background: ${(props) => (props.active ? "#4caf50" : "white")};
  color: ${(props) => (props.active ? "white" : "#666")};
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: ${(props) => (props.active ? "#45a049" : "#f5f5f5")};
    border-color: ${(props) => (props.active ? "#45a049" : "#ccc")};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const MessageInput = () => {
  const {
    sendMessage,
    isLoading,
    pendingToolCalls, // 修复命名：使用复数形式
    isAutoExecuteEnabled,
    toggleAutoExecute,
    inputContent,
    setInputText,
  } = useContext(ChatContext);
  const inputRef = useRef(null);

  const [tooltipContent, setTooltipContent] = useState("自动执行");

  // 检查是否有待确认的工具调用
  const hasPendingToolCalls = pendingToolCalls !== null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handletoggleAutoExecute = () => {
    toggleAutoExecute();
    setTooltipContent(isAutoExecuteEnabled ? "自动执行" : "取消自动执行");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 检查是否有待确认的工具调用
    if (hasPendingToolCalls) {
      message.warning(
        "请先确认或取消当前的工具调用，然后再发送新消息",
        "待确认工具调用"
      );
      return;
    }

    if (!inputContent.trim() || isLoading) return;

    const messageText = inputContent.trim();
    setInputText("");
    await sendMessage(messageText);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 处理用户尝试输入时的提示
  const handleInputChange = (e) => {
    if (hasPendingToolCalls && e.target.value.length > inputContent.length) {
      // 用户尝试添加新内容时提示
      message.info(
        "请先确认或取消当前的工具调用，再输入新消息",
        "待确认工具调用"
      );
      return; // 阻止输入
    }
    setInputText(e.target.value);
  };

  return (
    <InputContainer>
      <InputControls>
        <TextArea
          ref={inputRef}
          value={inputContent}
          onChange={handleInputChange}
          placeholder={
            hasPendingToolCalls
              ? "请先确认或取消工具调用..."
              : "有什么问题就来问我吧..."
          }
          disabled={isLoading || hasPendingToolCalls}
          onKeyDown={handleKeyDown}
        />
        {/* <AutoExecuteButton
          active={isAutoExecuteEnabled}
          onClick={() => {
            console.log(
              `[AUTO_DEBUG] 点击自动执行按钮，当前状态: ${isAutoExecuteEnabled}`
            );
            toggleAutoExecute();
          }}
          title={isAutoExecuteEnabled ? "点击取消自动执行" : "点击启用自动执行"}
        >
          {isAutoExecuteEnabled ? "取消自动执行" : "进入自动执行"}
        </AutoExecuteButton> */}
        <SendDiv>
          <SendLeftDiv>
            <SendFileUpload>
              {/* <img
                src={assAssociated}
                alt="send"
                style={{ width: "22px", height: "22px" }}
              /> */}
            </SendFileUpload>
          </SendLeftDiv>
          <SendRightDiv>
            <SendVoiceInput>
              {/* <Tooltip content="语音" position="top">
                <AiVoiceIcon
                  style={{ width: "22px", height: "22px", fill: "#666" }}
                />
              </Tooltip> */}
            </SendVoiceInput>
            <SendAutoExecute>
              <Tooltip content={tooltipContent} position="top">
                <FlashAutoIcon
                  onClick={handletoggleAutoExecute}
                  alt="auto"
                  style={{
                    width: "22px",
                    height: "22px",
                    fill: isAutoExecuteEnabled ? "#37913aff" : "#666",
                  }}
                ></FlashAutoIcon>
                {/* <img
                  src={flash_auto}
                  onClick={toggleAutoExecute}
                  alt="auto"
                  style={{
                    width: "22px",
                    height: "22px",
                    filter: "brightness(0)",
                  }}
                /> */}
              </Tooltip>
            </SendAutoExecute>

            <div style={{ marginBottom: "5px" }}>
              <SendButton
                onClick={handleSubmit}
                disabled={
                  isLoading || !inputContent.trim() || hasPendingToolCalls
                }
                isLoading={isLoading}
              >
                {isLoading ? (
                  <AiStop
                    style={{
                      width: "24px",
                      height: "24px",
                    }}
                  />
                ) : (
                  // <img
                  //   src={aistop}
                  //   alt="stop"

                  // />
                  <AiSend
                    style={{
                      width: "24px",
                      height: "24px",
                      filter: inputContent.trim() ? "none" : "grayscale(100%)",
                    }}
                  />
                  // <img
                  //   src={aisend}
                  //   alt="send"
                  //   style={{
                  //     width: "24px",
                  //     height: "24px",
                  //     filter: inputContent.trim() ? "none" : "grayscale(100%)",
                  //   }}
                  // />
                )}
              </SendButton>
            </div>
          </SendRightDiv>
        </SendDiv>

        {/* <SendButton
          onClick={handleSubmit}
          disabled={isLoading || !inputContent.trim() || hasPendingToolCalls}
        >
          <SendButtonText>
            {isLoading ? (
              <>
                执行中
                <LoadingDots />
              </>
            ) : (
              "发送"
            )}
          </SendButtonText>
        </SendButton> */}
      </InputControls>
    </InputContainer>
  );
};

export default MessageInput;
