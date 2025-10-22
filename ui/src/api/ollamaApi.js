import { getToken } from '../utils/utils';

const BASE_URL = window?.__APP_ENV__?.BASE_URL || process.env.REACT_APP_API_BASE_URL || '/api'
const STREAM_API_URL = BASE_URL + "/diy-agent/stream/";
export const generateStreamResponse = async (
  message,
  modelId,
  sessionId,
  onChunk
) => {
  console.log("[TOOL_DEBUG] generateStreamResponse request body:", {
    message,
    modelId,
    sessionId,
  });
  try {
    const response = await fetch(STREAM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
      },
      body: JSON.stringify({
        message: message,
        partId: modelId,
        sessionId: sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    // 处理SSE流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        const lines = block.split("\n");
        let eventType = "data";
        const dataLines = [];

        for (const l of lines) {
          if (l.startsWith("event: ")) {
            eventType = l.slice(7).trim();
          } else if (l.startsWith("data: ")) {
            dataLines.push(l.slice(6));
          } else if (l.startsWith("think: ")) {
            // backward compatibility for old think: line format
            eventType = "think";
            dataLines.push(l.slice(7));
          } else if (l.startsWith("tool_call: ")) {
            eventType = "tool_call";
            dataLines.push(l.slice(11));
          } else if (l.startsWith("tool_message: ")) {
            eventType = "tool_message";
            dataLines.push(l.slice(14));
          }
        }

        const dataStr = dataLines.join("\n").trim();
        if (!dataStr) continue;
        if (dataStr === "[DONE]") return;

        try {
          const parsed = JSON.parse(dataStr);
          // 对于特定事件类型，始终使用事件类型而不是数据中的type字段
          const finalType =
            eventType === "tool_message" ||
              eventType === "tool_call" ||
              eventType === "think"
              ? eventType
              : eventType !== "data"
                ? eventType
                : parsed.type || "data";

          // 调试日志
          if (eventType === "tool_message") {
            console.log("[SSE_DEBUG] tool_message 事件:", {
              eventType,
              parsedType: parsed.type,
              finalType,
              dataStr: dataStr.substring(0, 200) + "...",
            });
          }

          if (finalType === "tool_call" && Array.isArray(parsed)) {
            onChunk({ type: "tool_call", toolCalls: parsed });
          } else {
            // 确保 type 字段不被 parsed 对象覆盖
            const { type: _, ...parsedWithoutType } = parsed;
            onChunk({ type: finalType, ...parsedWithoutType });
          }
        } catch (error) {
          // 非JSON内容，按普通文本处理
          onChunk({ type: eventType, content: dataStr });
        }
      }
    }
  } catch (error) {
    console.error("Error calling Streaming API:", error);
    throw error;
  }
};

// 获取历史消息列表
export const getChatHistory = async (sessionId) => {
  try {
    console.log("[TOOL_DEBUG] getChatHistory 请求体:", { sessionId });
    const response = await fetch(
      `${BASE_URL}/ai/202512/modelAgent/history/${sessionId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: getToken(),
        },
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    console.log("获取到历史消息:", data);
    return data;
  } catch (error) {
    console.error("Error fetching chat history:", error);
    throw error;
  }
};

// 发送工具调用确认或取消请求（流式响应）
export const sendToolConfirmationStream = async (
  toolId,
  toolName,
  actionOrToolCalls,
  sessionId,
  onChunk,
) => {
  try {
    let requestBody;
    console.log("[TOOL_DEBUG] sendToolConfirmationStream 请求体:", {
      toolId,
      toolName,
      actionOrToolCalls,
      sessionId,
    });
    // 判断是否为新的工具调用数组格式
    if (Array.isArray(actionOrToolCalls)) {
      // 新格式：发送工具调用数组
      requestBody = {
        message: "",
        sessionId: sessionId,
        tool_calls: actionOrToolCalls, // 传递整个工具调用数组
      };
    } else {
      // 兼容旧格式：单个工具调用
      requestBody = {
        message: "",
        sessionId: sessionId,
        tool_name: toolName,
        tool_id: toolId,
        tool_action: actionOrToolCalls, // 'confirm' 或 'cancel'
      };
    }

    const response = await fetch(STREAM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    // 处理SSE流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        const lines = block.split("\n");
        let eventType = "data";
        const dataLines = [];

        for (const l of lines) {
          if (l.startsWith("event: ")) {
            eventType = l.slice(7).trim();
          } else if (l.startsWith("data: ")) {
            dataLines.push(l.slice(6));
          } else if (l.startsWith("think: ")) {
            eventType = "think";
            dataLines.push(l.slice(7));
          } else if (l.startsWith("tool_call: ")) {
            eventType = "tool_call";
            dataLines.push(l.slice(11));
          } else if (l.startsWith("tool_message: ")) {
            eventType = "tool_message";
            dataLines.push(l.slice(14));
          }
        }

        const dataStr = dataLines.join("\n").trim();
        if (!dataStr) continue;
        if (dataStr === "[DONE]") return;

        try {
          const parsed = JSON.parse(dataStr);
          // 对于特定事件类型，始终使用事件类型而不是数据中的type字段
          const finalType =
            eventType === "tool_message" ||
              eventType === "tool_call" ||
              eventType === "think"
              ? eventType
              : eventType !== "data"
                ? eventType
                : parsed.type || "data";

          // 调试日志
          if (eventType === "tool_message") {
            console.log(
              "[SSE_DEBUG] tool_message 事件 (sendToolConfirmationStream):",
              {
                eventType,
                parsedType: parsed.type,
                finalType,
                dataStr: dataStr.substring(0, 200) + "...",
              }
            );
          }

          if (finalType === "tool_call" && Array.isArray(parsed)) {
            onChunk({ type: "tool_call", toolCalls: parsed });
          } else {
            // 确保 type 字段不被 parsed 对象覆盖
            const { type: _, ...parsedWithoutType } = parsed;
            onChunk({ type: finalType, ...parsedWithoutType });
          }
        } catch (error) {
          onChunk({ type: eventType, content: dataStr });
        }
      }
    }
  } catch (error) {
    console.error("Error sending tool confirmation:", error);
    throw error;
  }
};
