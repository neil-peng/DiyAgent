import React, { createContext, useState, useEffect, useRef } from "react";
import {
  generateResponse,
  generateStreamResponse,
  sendToolConfirmationStream,
  getChatHistory,
} from "../api/ollamaApi";
import sessionManager from "../utils/sessionManager";
import { message } from '../components/MessageToast'
export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {

  useEffect(() => {
    // 监听sessionId变化事件
    const handleSessionChange = () => {
      console.log("检测到sessionId变化，重新加载历史消息");
      loadChatHistory();
    };
    window.addEventListener("sessionIdChanged", handleSessionChange);
    return () => {
      window.removeEventListener("sessionIdChanged", handleSessionChange);
    };
  }, []);

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [pendingToolCalls, setPendingToolCalls] = useState(null); // 当前待确认的工具调用列表
  const [isProcessingToolCalls, setIsProcessingToolCalls] = useState(false); // 是否正在处理工具调用
  const [isAutoExecuteEnabled, setIsAutoExecuteEnabled] = useState(false); // 自动执行模式开关
  const [inputContent, setInputContent] = useState(""); // 输入框内容

  // JSON检测和格式化工具函数
  const isValidJSON = (str) => {
    if (typeof str !== "string" || str.trim() === "") return false;
    try {
      const parsed = JSON.parse(str.trim());
      // 只有对象和数组才进行格式化，简单值不格式化
      return typeof parsed === "object" && parsed !== null;
    } catch (e) {
      return false;
    }
  };

  const formatJSON = (str) => {
    try {
      const parsed = JSON.parse(str.trim());
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return str; // 如果解析失败，返回原字符串
    }
  };

  const processMessageContent = (content) => {
    if (!content || typeof content !== "string")
      return { content, isJSON: false };

    // 检查是否整个内容都是JSON
    const trimmedContent = content.trim();
    if (isValidJSON(trimmedContent)) {
      return {
        content: formatJSON(trimmedContent),
        isJSON: true,
        isPureJSON: true,
        originalContent: content,
      };
    }

    // 检查是否包含JSON片段（在```json 代码块中或独立的JSON对象）
    const jsonPatterns = [
      /```json\s*([\s\S]*?)```/g, // ```json ... ```
      /```\s*([\s\S]*?)```/g, // ``` ... ```
    ];

    let hasJSON = false;
    let processedContent = content;
    const jsonBlocks = [];

    // 首先处理代码块中的 JSON
    for (const pattern of jsonPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const jsonCandidate = match[1] || match[0];
        if (isValidJSON(jsonCandidate)) {
          hasJSON = true;
          const formatted = formatJSON(jsonCandidate);
          const blockId = `__JSON_BLOCK_${jsonBlocks.length}__`;
          jsonBlocks.push({
            id: blockId,
            original: match[0],
            formatted: formatted,
            raw: jsonCandidate,
          });
          processedContent = processedContent.replace(match[0], blockId);
        }
      }
    }

    // 然后寻找独立的 JSON 对象（不在代码块中）
    const findJsonObjects = (text) => {
      const results = [];
      let i = 0;

      while (i < text.length) {
        if (text[i] === "{") {
          let braceCount = 1;
          let j = i + 1;
          let start = i;

          // 检查这个 { 前面是否在单词中间（避免误匹配）
          if (start > 0) {
            const prevChar = text[start - 1];
            // 如果前面是字母或数字，跳过（可能是变量名的一部分）
            if (/[a-zA-Z0-9_]/.test(prevChar)) {
              i++;
              continue;
            }
          }

          while (j < text.length && braceCount > 0) {
            if (text[j] === "{") {
              braceCount++;
            } else if (text[j] === "}") {
              braceCount--;
            } else if (text[j] === '"') {
              // 跳过字符串内容
              j++;
              while (j < text.length && text[j] !== '"') {
                if (text[j] === "\\") j++; // 跳过转义字符
                j++;
              }
            }
            j++;
          }

          if (braceCount === 0) {
            const jsonCandidate = text.substring(i, j);
            // 更严格的验证：JSON 必须以 { 开头，以 } 结尾，且长度足够
            if (
              jsonCandidate.startsWith("{") &&
              jsonCandidate.endsWith("}") &&
              jsonCandidate.length > 20 &&
              isValidJSON(jsonCandidate)
            ) {
              // 检查后面的字符，确保这是一个完整的 JSON 块
              const nextChar = j < text.length ? text[j] : "";
              if (!nextChar || /[\s\n\r,;.]/.test(nextChar)) {
                results.push({
                  start: i,
                  end: j,
                  content: jsonCandidate,
                  fullMatch: jsonCandidate,
                });
              }
            }
          }
          i = j;
        } else {
          i++;
        }
      }

      return results;
    };

    // 查找独立的 JSON 对象（从后往前处理，避免位置偏移）
    const jsonObjects = findJsonObjects(processedContent);
    for (let i = jsonObjects.length - 1; i >= 0; i--) {
      const obj = jsonObjects[i];
      const formatted = formatJSON(obj.content);
      const blockId = `__JSON_BLOCK_${jsonBlocks.length}__`;

      jsonBlocks.push({
        id: blockId,
        original: obj.fullMatch,
        formatted: formatted,
        raw: obj.content,
      });

      processedContent =
        processedContent.substring(0, obj.start) +
        blockId +
        processedContent.substring(obj.end);
      hasJSON = true;
    }

    if (hasJSON) {
      return {
        content: processedContent,
        isJSON: true,
        isPureJSON: false,
        jsonBlocks: jsonBlocks,
        originalContent: content,
      };
    }

    return { content, isJSON: false };
  };

  // 添加一个 ref 来存储当前流式消息的完整内容
  const currentStreamContent = useRef("");
  // 添加思考内容的状态管理
  const currentThinkContent = useRef("");
  // 添加思考内容数组，保存所有think事件
  const thinkContentList = useRef([]);

  // 加载历史消息
  const loadChatHistory = async () => {
    try {
      const sessionId = sessionManager.getSessionId();
      console.log("开始加载历史消息，sessionId:", sessionId);

      const historyData = await getChatHistory(sessionId);

      if (
        historyData &&
        historyData.messages &&
        Array.isArray(historyData.messages)
      ) {
        console.log("加载到历史消息:", historyData.messages.length, "条");

        // 转换历史消息格式以适配当前的消息结构（保留所有类型）
        const convertedMessages = historyData.messages.map((msg) => {
          // 判断消息类型
          const isUser =
            msg.type === "HumanMessage" ||
            msg.type === "HumanMessageChunk" ||
            msg.isUser;
          const isAI =
            msg.type === "AIMessage" || msg.type === "AIMessageChunk";

          const baseMessage = {
            id:
              msg.id ||
              msg.index?.toString() ||
              Date.now().toString() + Math.random(),
            content: "",
            isUser: isUser,
            isStreaming: false,
            isThinking: false,
            thinkContentList: msg.thinkContentList || [],
            activeThinkIndex: -1,
          };

          console.log("处理消息:", {
            type: msg.type,
            isUser: isUser,
            isAI: isAI,
            index: msg.index,
          });

          // 处理content内容（对话文本）
          if (typeof msg.content === "string") {
            const processedContent = processMessageContent(msg.content);
            baseMessage.content = processedContent.content;
            baseMessage.isJSON = processedContent.isJSON;
            baseMessage.isPureJSON = processedContent.isPureJSON;
            baseMessage.jsonBlocks = processedContent.jsonBlocks;
            baseMessage.originalContent = processedContent.originalContent;
          } else if (msg.content && Array.isArray(msg.content)) {
            // 如果content是数组，提取文本内容
            const textItems = msg.content.filter(
              (item) => typeof item === "string" || (item && item.text)
            );

            if (textItems.length > 0) {
              const contentString = textItems
                .map((item) => (typeof item === "string" ? item : item.text))
                .join("");

              const processedContent = processMessageContent(contentString);
              baseMessage.content = processedContent.content;
              baseMessage.isJSON = processedContent.isJSON;
              baseMessage.isPureJSON = processedContent.isPureJSON;
              baseMessage.jsonBlocks = processedContent.jsonBlocks;
              baseMessage.originalContent = processedContent.originalContent;
            }
          }

          // 如果是AI消息并且包含tool_calls，则转换为一条“工具确认”消息
          if (
            isAI &&
            msg.tool_calls &&
            Array.isArray(msg.tool_calls) &&
            msg.tool_calls.length > 0
          ) {
            const tools = msg.tool_calls.map((tc) => ({
              tool_call_id: tc.tool_call_id || tc.id,
              tool_call_name: tc.tool_call_name || tc.name,
              tool_call_args: tc.tool_call_args || tc.args,
              tool_confirm_action: tc.tool_confirm_action || null,
            }));

            return {
              id: baseMessage.id,
              content: "",
              isUser: false,
              isToolCall: true,
              isToolCallReadOnly: true,
              toolCalls: tools,
              toolCallStatuses: tools.reduce((acc, t) => {
                acc[t.tool_call_id] = t.tool_confirm_action || null;
                return acc;
              }, {}),
              isStreaming: false,
              isThinking: false,
              thinkContentList: [],
              activeThinkIndex: -1,
            };
          }

          // ToolMessage：把内容按JSON渲染
          if (msg.type === "ToolMessage") {
            const processed = processMessageContent(msg.content || "");
            baseMessage.content = processed.content;
            baseMessage.isJSON = processed.isJSON;
            baseMessage.isPureJSON = processed.isPureJSON;
            baseMessage.jsonBlocks = processed.jsonBlocks;
            baseMessage.originalContent = processed.originalContent;
            baseMessage.isToolMessage = true; // 标识这是工具消息，使用特殊样式
          }

          // 如果有3D代码，保留
          if (msg.code) {
            baseMessage.code = msg.code;
          }

          return baseMessage;
        });

        setMessages(convertedMessages);

        // 恢复最后一条“仍待确认”的工具集
        const lastPending = [...convertedMessages]
          .reverse()
          .find(
            (m) =>
              m.isToolCall &&
              m.toolCalls &&
              m.toolCallStatuses &&
              m.toolCalls.some((t) => !m.toolCallStatuses[t.tool_call_id])
          );
        if (lastPending) {
          setPendingToolCalls({
            messageId: lastPending.id,
            tools: lastPending.toolCalls,
          });
          console.log("[TOOL] 恢复待确认的工具调用:", lastPending.toolCalls);
        } else {
          setPendingToolCalls(null);
          setIsLoading(false);
        }

        return convertedMessages;
      } else {
        console.log("没有历史消息或格式不正确");
        return [];
      }
    } catch (error) {
      message.error("加载历史消息失败", error.message);
      console.error("加载历史消息失败:", error);
      return [];
    }
  };

  //useEffect(() => {}, []); // 只在组件挂载时执行一次

  // 自动执行模式切换函数
  const toggleAutoExecute = () => {
    console.log(`[AUTO_DEBUG] 切换前状态: ${isAutoExecuteEnabled}`);
    setIsAutoExecuteEnabled((prev) => {
      const newValue = !prev;
      console.log(`[AUTO_DEBUG] 切换后状态: ${newValue}`);
      return newValue;
    });
    console.log(
      `[AUTO_DEBUG] 自动执行模式${!isAutoExecuteEnabled ? "已开启" : "已关闭"}`
    );
  };

  // 设置输入框内容
  const setInputText = (text) => {
    setInputContent(text);
  };

  const sendMessage = async (content) => {
    // 重置流式内容
    currentStreamContent.current = "";
    currentThinkContent.current = "";
    thinkContentList.current = [];

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + "_user",
        content,
        isUser: true,
      },
    ]);
    setIsLoading(true);

    try {
      // 3D模型管理相关代码已移除

      // 文本聊天内容使用流式API，创建一个空消息用于流式更新
      const messageId = Date.now().toString();
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          {
            id: messageId,
            content: "",
            isUser: false,
            isStreaming: true,
            isThinking: false,
            thinkContentList: [],
            activeThinkIndex: -1, // 添加当前活跃的think索引
          },
        ];
        setStreamingMessageId(messageId);
        return newMessages;
      });

      // 使用流式API获取响应
      await generateStreamResponse(
        content,
        null,
        sessionManager.getSessionId(),
        (chunk) => {
          // 添加详细日志记录
          console.log("收到流式响应chunk:", JSON.stringify(chunk));

          if (chunk.type === "think") {
            // 处理思考内容 - 包括节点进度和thinking事件
            if (chunk.content) {
              // 将新的think内容添加到数组中
              thinkContentList.current.push(chunk.content);
              console.log(`收到think内容: '${chunk.content}'`);
              console.log(`当前think内容列表:`, thinkContentList.current);

              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.isStreaming) {
                  lastMessage.isThinking = true;
                  lastMessage.thinkContentList = [...thinkContentList.current];
                  // 设置当前活跃的think索引为最新的索引
                  lastMessage.activeThinkIndex =
                    thinkContentList.current.length - 1;
                }
                return newMessages;
              });
            }
          } else if (chunk.type === "tool_call") {
            // 收到新的工具调用
            handleNewToolCalls(chunk);
            setIsLoading(false);
          } else if (chunk.type === "tool_message") {
            // 直接渲染工具返回的数据详情（插入到当前流式消息之前）
            console.log(
              "[TOOL_MESSAGE] 收到 tool_message (generateStreamResponse):",
              chunk
            );
            console.log(
              "[TOOL_MESSAGE_DEBUG] 正在处理tool_message，即将创建绿色工具调用结果"
            );
            let tmContent = "";
            if (typeof chunk.content === "string") {
              tmContent = chunk.content;
            } else if (chunk.message?.kwargs?.content) {
              tmContent = chunk.message.kwargs.content;
            } else if (chunk.kwargs?.content) {
              tmContent = chunk.kwargs.content;
            } else {
              try {
                tmContent = JSON.stringify(chunk, null, 2);
              } catch (e) {
                tmContent = String(chunk);
              }
            }

            setMessages((prev) => {
              const processed = processMessageContent(tmContent);

              // 提取工具名称
              let toolName = null;
              if (chunk.name) {
                toolName = chunk.name;
              } else if (chunk.message?.kwargs?.name) {
                toolName = chunk.message.kwargs.name;
              } else if (chunk.kwargs?.name) {
                toolName = chunk.kwargs.name;
              }

              const toolMsg = {
                id: Date.now().toString() + "_toolmsg",
                content: processed.content,
                isUser: false,
                isStreaming: false,
                isThinking: false,
                isJSON: processed.isJSON,
                isPureJSON: processed.isPureJSON,
                jsonBlocks: processed.jsonBlocks,
                originalContent: processed.originalContent,
                isToolMessage: true, // 标识这是来自tool_message的消息
                toolName: toolName, // 保存工具名称
              };
              console.log("[TOOL_MESSAGE_DEBUG] 创建的工具消息对象:", toolMsg);
              // tool_message 完全独立渲染，直接追加到消息列表末尾
              return [...prev, toolMsg];
            });

            // 重置流式内容缓存，准备接收后续的 data chunks
            currentStreamContent.current = "";
            // 清空流式消息ID，等待第一个 data chunk 时再创建
            setStreamingMessageId(null);
          } else if (chunk.type === "data") {
            // 处理普通数据
            if (chunk.content) {
              if (typeof chunk.content === "string") {
                // 普通文本内容，添加到流式消息中
                currentStreamContent.current += chunk.content;
                console.log(`收到文本chunk: '${chunk.content}'`);
                console.log(`当前完整内容: '${currentStreamContent.current}'`);

                // 每次更新都使用完整内容替换，而不是追加
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];

                  // 如果最后一条消息不是流式消息，创建一个新的流式消息
                  if (!lastMessage || !lastMessage.isStreaming) {
                    const streamingMsg = {
                      id: Date.now().toString() + "_streaming",
                      content: currentStreamContent.current,
                      isUser: false,
                      isStreaming: true,
                      isThinking: false,
                    };
                    setStreamingMessageId(streamingMsg.id);
                    return [...newMessages, streamingMsg];
                  } else {
                    // 更新现有的流式消息
                    lastMessage.content = currentStreamContent.current;
                    // 收到普通内容时，停止思考状态和动画
                    lastMessage.isThinking = false;
                    lastMessage.activeThinkIndex = -1;
                    return newMessages;
                  }
                });
              }
            }

            if (chunk.code) {
              // 有code，是3D数据，替换为完整消息
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                // 替换流式消息为完整的3D消息
                newMessages[lastIndex] = {
                  id: messageId,
                  content: "", // 3D数据通常不需要文本内容
                  code: chunk.code,
                  isUser: false,
                  isStreaming: false,
                  // 保留思考相关的状态
                  isThinking: false,
                  thinkContentList:
                    newMessages[lastIndex]?.thinkContentList || [],
                  activeThinkIndex: -1,
                };
                return newMessages;
              });
              // 收到3D数据后立即清除流式状态
              setStreamingMessageId(null);
            }
          }
        },
      );

      // 流式传输完成后，更新消息标记并处理JSON格式化
      setMessages((prev) => {
        const newMessages = [...prev];
        const streamingMessage = newMessages.find((msg) => msg.isStreaming);
        if (streamingMessage) {
          streamingMessage.isStreaming = false;
          // 流式传输完成后，停止思考状态
          streamingMessage.isThinking = false;
          streamingMessage.activeThinkIndex = -1;

          // 检查并格式化JSON内容
          if (streamingMessage.content) {
            const processedContent = processMessageContent(
              streamingMessage.content
            );
            streamingMessage.content = processedContent.content;
            streamingMessage.isJSON = processedContent.isJSON;
            streamingMessage.isPureJSON = processedContent.isPureJSON;
            streamingMessage.jsonBlocks = processedContent.jsonBlocks;
            streamingMessage.originalContent = processedContent.originalContent;
          }
        }
        return newMessages;
      });
      setStreamingMessageId(null);
      setIsLoading(false); // 确保在流式完成后立即设置loading为false
    } catch (error) {
      message.error("请求出错", error.message);
      console.error("Error:", error);
      // 移除流式消息并添加错误消息
      setMessages((prev) => {
        // 移除任何正在流式的消息
        const filteredMessages = prev.filter((msg) => !msg.isStreaming);
        // 添加错误消息
        return [
          ...filteredMessages,
          {
            content: "抱歉，发生了错误，请稍后重试。",
            isUser: false,
          },
        ];
      });
      setStreamingMessageId(null);
    } finally {
      // 结束时清空 ref
      currentStreamContent.current = "";
      currentThinkContent.current = "";
      thinkContentList.current = [];
      setIsLoading(false);
    }
  };

  // 工具调用确认处理 - 简化版本
  const confirmToolCall = async (toolCallId) => {
    console.log(`[TOOL] 确认工具调用: ${toolCallId}`);

    if (!pendingToolCalls) {
      console.log(`[TOOL] confirmToolCall 返回：pendingToolCalls 为空`);
      return;
    }

    // 捕获当前的 pendingToolCalls 值，避免闭包问题
    const currentPendingToolCalls = pendingToolCalls;

    // 更新消息中的工具调用状态
    setMessages((prev) => {
      const newMessages = [...prev];
      const toolMessage = newMessages.find(
        (msg) => msg.id === currentPendingToolCalls.messageId
      );
      if (toolMessage && toolMessage.toolCallStatuses) {
        toolMessage.toolCallStatuses[toolCallId] = "confirmed";
        console.log(`[TOOL] 工具状态已更新: ${toolCallId} -> confirmed`);
      }
      return newMessages;
    });

    // 延迟检查，使用捕获的值
    setTimeout(() => {
      checkAndSendAllToolCallsWithCapturedData(currentPendingToolCalls);
    }, 50);
  };

  const cancelToolCall = async (toolCallId) => {
    console.log(`[TOOL] 取消工具调用: ${toolCallId}`);

    if (!pendingToolCalls) return;

    // 捕获当前的 pendingToolCalls 值，避免闭包问题
    const currentPendingToolCalls = pendingToolCalls;

    // 更新消息中的工具调用状态
    setMessages((prev) => {
      const newMessages = [...prev];
      const toolMessage = newMessages.find(
        (msg) => msg.id === currentPendingToolCalls.messageId
      );
      if (toolMessage && toolMessage.toolCallStatuses) {
        toolMessage.toolCallStatuses[toolCallId] = "cancelled";
      }
      return newMessages;
    });

    // 延迟检查，使用捕获的值
    setTimeout(() => {
      checkAndSendAllToolCallsWithCapturedData(currentPendingToolCalls);
    }, 50);
  };

  // 使用捕获的数据检查工具调用状态
  const checkAndSendAllToolCallsWithCapturedData = async (
    capturedPendingToolCalls
  ) => {
    if (!capturedPendingToolCalls || isProcessingToolCalls) {
      console.log("[TOOL] checkAndSendAllToolCallsWithCapturedData 跳过:", {
        hasCaptured: !!capturedPendingToolCalls,
        isProcessing: isProcessingToolCalls,
      });
      return;
    }

    console.log("[TOOL] 开始检查工具调用状态 (捕获数据)");

    // 从当前messages中找到对应消息
    const currentMessages = messages;
    const toolMessage = currentMessages.find(
      (msg) => msg.id === capturedPendingToolCalls.messageId
    );

    if (!toolMessage || !toolMessage.toolCallStatuses) {
      console.log("[TOOL] 未找到工具消息或状态对象");
      return;
    }

    // 检查是否所有工具都有状态
    const allCompleted = capturedPendingToolCalls.tools.every(
      (tool) =>
        toolMessage.toolCallStatuses[tool.tool_call_id] === "confirmed" ||
        toolMessage.toolCallStatuses[tool.tool_call_id] === "cancelled"
    );

    console.log("[TOOL] 检查工具状态 (捕获数据):", {
      tools: capturedPendingToolCalls.tools.map((t) => t.tool_call_id),
      statuses: toolMessage.toolCallStatuses,
      allCompleted,
    });

    if (allCompleted) {
      console.log("[TOOL] 所有工具调用已确认/取消，开始发送");

      // 防止重复调用
      setIsProcessingToolCalls(true);
      setPendingToolCalls(null);

      try {
        // 构建带状态的工具调用数组
        const toolCallsWithStatus = capturedPendingToolCalls.tools.map(
          (tool) => ({
            ...tool,
            tool_confirm_action:
              toolMessage.toolCallStatuses[tool.tool_call_id],
          })
        );

        console.log(
          "[TOOL] 发送的工具调用数据 (捕获数据):",
          toolCallsWithStatus
        );

        setIsLoading(true);
        await sendToolCalls(toolCallsWithStatus);
      } catch (error) {
        console.error("[TOOL] 发送工具调用失败:", error);
        setIsProcessingToolCalls(false);
        setIsLoading(false);
      }
    }
  };

  // 一键确认整组工具
  const confirmToolBatch = async () => {
    if (!pendingToolCalls || isProcessingToolCalls) return;

    const toolCallsWithStatus = pendingToolCalls.tools.map((tool) => ({
      ...tool,
      tool_confirm_action: "confirmed",
    }));

    await sendToolCalls(toolCallsWithStatus);
  };

  // 一键取消整组工具
  const cancelToolBatch = async () => {
    if (!pendingToolCalls || isProcessingToolCalls) return;

    const toolCallsWithStatus = pendingToolCalls.tools.map((tool) => ({
      ...tool,
      tool_confirm_action: "cancelled",
    }));

    await sendToolCalls(toolCallsWithStatus);
  };

  // 统一发送工具调用（批量）
  const sendToolCalls = async (toolCallsWithStatus) => {
    try {
      setIsProcessingToolCalls(true);
      setIsLoading(true);

      // 清空当前pending，避免重复提交
      const saved = pendingToolCalls;
      setPendingToolCalls(null);

      // 不预先创建空的流式消息，等到实际需要时再创建
      setStreamingMessageId(null);

      currentStreamContent.current = "";
      thinkContentList.current = [];

      await sendToolConfirmationStream(
        null,
        null,
        toolCallsWithStatus,
        sessionManager.getSessionId(),
        (chunk) => {
          if (chunk.type === "data") {
            console.log(
              "[DATA_DEBUG] 处理 data chunk (sendToolConfirmationStream 2):",
              chunk
            );
          }

          if (chunk.type === "think") {
            if (chunk.content) {
              thinkContentList.current.push(chunk.content);
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.isStreaming) {
                  lastMessage.isThinking = true;
                  lastMessage.thinkContentList = [...thinkContentList.current];
                  lastMessage.activeThinkIndex =
                    thinkContentList.current.length - 1;
                }
                return newMessages;
              });
            }
          } else if (chunk.type === "tool_call") {
            // 收到新的工具列表
            handleNewToolCalls(chunk);
          } else if (chunk.type === "tool_message") {
            // 处理 tool_message - 完全独立渲染
            console.log("[TOOL_MESSAGE] 收到 tool_message:", chunk);
            let tmContent = "";
            if (typeof chunk.content === "string") {
              tmContent = chunk.content;
            } else if (chunk.message?.kwargs?.content) {
              tmContent = chunk.message.kwargs.content;
            } else if (chunk.kwargs?.content) {
              tmContent = chunk.kwargs.content;
            } else {
              try {
                tmContent = JSON.stringify(chunk, null, 2);
              } catch (e) {
                tmContent = String(chunk);
              }
            }

            setMessages((prev) => {
              const processed = processMessageContent(tmContent);

              // 提取工具名称
              let toolName = null;
              if (chunk.name) {
                toolName = chunk.name;
              } else if (chunk.message?.kwargs?.name) {
                toolName = chunk.message.kwargs.name;
              } else if (chunk.kwargs?.name) {
                toolName = chunk.kwargs.name;
              }

              const toolMsg = {
                id: Date.now().toString() + "_toolmsg",
                content: processed.content,
                isUser: false,
                isStreaming: false,
                isThinking: false,
                isJSON: processed.isJSON,
                isPureJSON: processed.isPureJSON,
                jsonBlocks: processed.jsonBlocks,
                originalContent: processed.originalContent,
                isToolMessage: true, // 标识这是来自tool_message的消息
                toolName: toolName, // 保存工具名称
              };
              // tool_message 完全独立渲染，直接追加到消息列表末尾
              return [...prev, toolMsg];
            });
          } else if (chunk.type === "data" && chunk.content) {
            if (typeof chunk.content === "string") {
              currentStreamContent.current += chunk.content;
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];

                // 如果最后一条消息不是流式消息，创建一个新的流式消息
                if (!lastMessage || !lastMessage.isStreaming) {
                  const streamingMsg = {
                    id: Date.now().toString() + "_streaming",
                    content: currentStreamContent.current,
                    isUser: false,
                    isStreaming: true,
                    isThinking: false,
                  };
                  setStreamingMessageId(streamingMsg.id);
                  return [...newMessages, streamingMsg];
                } else {
                  // 更新现有的流式消息
                  lastMessage.content = currentStreamContent.current;
                  lastMessage.isThinking = false;
                  lastMessage.activeThinkIndex = -1;
                  return newMessages;
                }
              });
            }
          }
        },
      );

      // 完成流式响应
      setMessages((prev) => {
        const newMessages = [...prev];
        const streamingMessage = newMessages.find((msg) => msg.isStreaming);
        if (streamingMessage) {
          streamingMessage.isStreaming = false;
          streamingMessage.isThinking = false;
          streamingMessage.activeThinkIndex = -1;

          if (streamingMessage.content) {
            const processedContent = processMessageContent(
              streamingMessage.content
            );
            streamingMessage.content = processedContent.content;
            streamingMessage.isJSON = processedContent.isJSON;
            streamingMessage.isPureJSON = processedContent.isPureJSON;
            streamingMessage.jsonBlocks = processedContent.jsonBlocks;
            streamingMessage.originalContent = processedContent.originalContent;
          }
        }
        return newMessages;
      });
      setStreamingMessageId(null);
      setIsLoading(false); // 确保工具调用完成后也设置loading为false
    } catch (error) {
      console.error("[TOOL] 批量发送失败:", error);
      message.error("提交工具集失败，请重试。", error.message);
      setMessages((prev) => [
        ...prev,
        { content: "提交工具集失败，请重试。", isUser: false },
      ]);
    } finally {
      setIsProcessingToolCalls(false);
      setIsLoading(false);
      currentStreamContent.current = "";
      thinkContentList.current = [];
    }
  };

  // 处理新的工具调用
  const handleNewToolCalls = (chunk) => {
    console.log("[TOOL] 收到新的工具调用:", chunk);

    // 结束当前流式消息
    setMessages((prev) => {
      const newMessages = [...prev];
      const streamingMessage = newMessages.find((msg) => msg.isStreaming);
      if (streamingMessage) {
        streamingMessage.isStreaming = false;
        streamingMessage.isThinking = false;
        streamingMessage.activeThinkIndex = -1;
      }
      return newMessages;
    });
    setStreamingMessageId(null);

    // 解析工具调用数据
    let toolCalls = [];
    if (chunk.toolCalls && Array.isArray(chunk.toolCalls)) {
      toolCalls = chunk.toolCalls;
    } else if (Array.isArray(chunk)) {
      toolCalls = chunk;
    } else if (chunk.tool_call_name || chunk.tool_name || chunk.tool_id) {
      toolCalls = [
        {
          tool_call_id: chunk.tool_call_id || chunk.tool_id,
          tool_call_name: chunk.tool_call_name || chunk.tool_name,
          tool_call_args: chunk.tool_call_args || chunk.tool_args,
          tool_confirm_action: "to_confirm",
        },
      ];
    } else {
      console.warn("[TOOL] 无法解析的工具调用格式:", chunk);
      return;
    }

    // 创建新的工具调用消息
    const toolMessageId =
      Date.now().toString() +
      "_tool_" +
      Math.random().toString(36).substring(2, 8);

    setMessages((prev) => [
      ...prev,
      {
        id: toolMessageId,
        content: "",
        isUser: false,
        isToolCall: true,
        toolCalls: toolCalls,
        toolCallStatuses: toolCalls.reduce((acc, tool) => {
          acc[tool.tool_call_id] = null; // 待确认
          return acc;
        }, {}),
        isStreaming: false,
        isThinking: false,
        thinkContentList: [],
        activeThinkIndex: -1,
      },
    ]);

    console.log("[TOOL] 新工具调用已准备确认:", {
      messageId: toolMessageId,
      tools: toolCalls,
    });
    console.log(`[AUTO_DEBUG] 当前自动执行状态: ${isAutoExecuteEnabled}`);

    // 只在非自动执行模式下设置待确认状态（避免双重处理）
    if (!isAutoExecuteEnabled) {
      setPendingToolCalls({
        messageId: toolMessageId,
        tools: toolCalls,
      });
    }

    // 如果开启了自动执行模式，自动确认所有工具调用
    if (isAutoExecuteEnabled) {
      console.log("[AUTO] 自动执行模式已开启，自动确认所有工具调用");
      console.log(
        "[AUTO] 即将自动确认的工具:",
        toolCalls.map((t) => t.tool_call_id)
      );

      // 直接处理自动确认，不设置 pendingToolCalls（避免手动确认逻辑干扰）
      setMessages((prev) => {
        const newMessages = [...prev];
        const toolMessage = newMessages.find((msg) => msg.id === toolMessageId);
        if (toolMessage && toolMessage.toolCallStatuses) {
          // 自动确认所有工具
          toolCalls.forEach((tool) => {
            toolMessage.toolCallStatuses[tool.tool_call_id] = "confirmed";
            console.log(
              `[AUTO_DEBUG] 工具状态已自动更新: ${tool.tool_call_id} -> confirmed`
            );
          });
        }
        return newMessages;
      });

      // 立即发送工具调用（不设置pendingToolCalls，避免手动逻辑干扰）
      setTimeout(() => {
        console.log("[AUTO] 开始自动发送工具调用...");
        autoSendToolCalls(toolMessageId, toolCalls);
      }, 50);
    } else {
      console.log("[AUTO_DEBUG] 自动执行模式未开启，需要手动确认");
    }
  };

  // 专门用于自动执行的发送函数
  const autoSendToolCalls = async (toolMessageId, toolCalls) => {
    if (isProcessingToolCalls) {
      console.log("[AUTO] 已在处理工具调用，跳过自动发送");
      return;
    }

    console.log("[AUTO] 开始自动发送工具调用");
    setIsProcessingToolCalls(true);
    setIsLoading(true);

    try {
      // 构建带状态的工具调用数组（全部confirmed）
      const toolCallsWithStatus = toolCalls.map((tool) => ({
        ...tool,
        tool_confirm_action: "confirmed",
      }));

      console.log("[AUTO] 发送的工具调用数据:", toolCallsWithStatus);

      // 发送工具调用确认到后端
      await sendToolCalls(toolCallsWithStatus);
    } catch (error) {
      console.error("[AUTO] 自动发送工具调用失败:", error);
      message.error("自动发送工具调用时发生错误。", error.message);
      setMessages((prev) => [
        ...prev,
        {
          content: "自动发送工具调用时发生错误，请稍后重试。",
          isUser: false,
        },
      ]);
    } finally {
      setIsProcessingToolCalls(false);
      setIsLoading(false);
    }
  };

  // 兼容函数：单个工具调用确认/取消
  const confirmSingleToolCall = (toolCallId) => confirmToolCall(toolCallId);
  const cancelSingleToolCall = (toolCallId) => cancelToolCall(toolCallId);

  // 调试函数 - 测试历史消息解析
  const debugParseHistoryMessage = (rawMessage) => {
    console.log("原始历史消息:", rawMessage);

    // 检查是否应该过滤
    if (rawMessage.type === "ToolMessage") {
      console.log("ToolMessage - 将被过滤，不显示");
      return null;
    }

    // 判断消息类型
    const isUser =
      rawMessage.type === "HumanMessage" ||
      rawMessage.type === "HumanMessageChunk" ||
      rawMessage.isUser;
    const isAI =
      rawMessage.type === "AIMessage" || rawMessage.type === "AIMessageChunk";

    const baseMessage = {
      id:
        rawMessage.id ||
        rawMessage.index?.toString() ||
        Date.now().toString() + Math.random(),
      content: "",
      isUser: isUser,
      isStreaming: false,
      isThinking: false,
      thinkContentList: rawMessage.thinkContentList || [],
      activeThinkIndex: -1,
    };

    console.log("消息类型判断:", {
      type: rawMessage.type,
      isUser: isUser,
      isAI: isAI,
      willDisplay: isUser || isAI,
    });

    // 处理content内容（对话文本）
    if (typeof rawMessage.content === "string") {
      baseMessage.content = rawMessage.content;
    } else if (rawMessage.content && Array.isArray(rawMessage.content)) {
      const textItems = rawMessage.content.filter(
        (item) => typeof item === "string" || (item && item.text)
      );

      if (textItems.length > 0) {
        baseMessage.content = textItems
          .map((item) => (typeof item === "string" ? item : item.text))
          .join("");
      }
    }

    // 检查新格式的tool_call (在tool_calls数组中)
    if (
      rawMessage.tool_calls &&
      Array.isArray(rawMessage.tool_calls) &&
      rawMessage.tool_calls.length > 0
    ) {
      const toolCallContent = rawMessage.tool_calls[0];

      // 兼容性检查：支持有type字段或者直接有name/id/args字段的格式
      if (
        toolCallContent &&
        (toolCallContent.type === "tool_call" ||
          (toolCallContent.name && toolCallContent.id && toolCallContent.args))
      ) {
        baseMessage.isToolCall = true;
        baseMessage.toolCall = {
          tool_id: toolCallContent.id,
          tool_name: toolCallContent.name,
          tool_args: toolCallContent.args,
        };
        baseMessage.toolCallStatus = rawMessage.toolCallStatus;
      }
    }

    console.log("解析后的消息:", baseMessage);
    return baseMessage;
  };

  // 调试函数 - 测试消息过滤
  const debugFilterMessages = (messages) => {
    console.log("原始消息列表:", messages);

    const filtered = messages.filter((msg) => msg.type !== "ToolMessage");
    const byType = messages.reduce((acc, msg) => {
      const type = msg.type || "unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    console.log("消息类型统计:", byType);
    console.log("过滤前数量:", messages.length);
    console.log("过滤后数量:", filtered.length);
    console.log("过滤掉的数量:", messages.length - filtered.length);

    return filtered;
  };

  // 暴露调试函数到全局
  if (typeof window !== "undefined") {
    window.debugParseHistoryMessage = debugParseHistoryMessage;
    window.debugFilterMessages = debugFilterMessages;
    window.testJsonProcessing = (content) => {
      console.log("测试内容:", content);
      const result = processMessageContent(content);
      console.log("处理结果:", result);
      if (result.jsonBlocks) {
        console.log("JSON块数量:", result.jsonBlocks.length);
        result.jsonBlocks.forEach((block, index) => {
          console.log(`JSON块 ${index + 1}:`, block);
        });
      }
      return result;
    };

    // 添加专门的测试用例
    window.testComplexJson = () => {
      const testContent = `零件已成功创建，详细信息如下：

{ "code": "CAD005003", "name": "aaaa", "description": "这是第5003号CAD零件的描述信息", "submitDescription": "提交描述：零件5003已完成设计并提交审核", "partType": "NEUE_ASM", "mass": 17.472, "material": "碳钢", "gravityCenter": "(6.56, -5.04, 6.66)", "volume": 1.119858, "solidSurfaceArea": 25.0205, "openSurfaceArea": 2.8149, "version": { "versionNumber": "v3.2", "createTime": "2025-08-15T09:48:45.603350", "createdBy": "user9" }, "owner": { "ownerName": "owner4", "department": "设计部门" }, "lifecycleState": "PaaS.LifecycleState'INACTIVE'", "thumbnail": null }

创建完成！`;

      return window.testJsonProcessing(testContent);
    };
  }

  return (
    <ChatContext.Provider
      value={{
        messages,
        isLoading,
        sendMessage,

        streamingMessageId,
        pendingToolCalls,
        confirmToolCall,
        cancelToolCall,
        confirmSingleToolCall,
        cancelSingleToolCall,
        isProcessingToolCalls,
        loadChatHistory,
        isAutoExecuteEnabled,
        toggleAutoExecute,
        inputContent,
        setInputText,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
