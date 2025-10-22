import React, { useEffect, useRef, useState, useContext } from "react";
import styled from "@emotion/styled";
import ReactMarkdown from "react-markdown";

import { ChatContext } from "../context/ChatContext";
import Collapse from "../assets/Collapse.svg";
import Expand from "../assets/Expand.svg";
const MessageContainer = styled.div`
  margin-bottom: 0.8rem;
  display: flex;
  flex-direction: ${(props) => (props.isUser ? "row-reverse" : "row")};
`;

const MessageContent = styled.div`
  max-width: 85%;
  width: fit-content;
  border-radius: 8px;
  background: ${(props) => (props.isUser ? "#DEE8FF" : "#F7F8FA")};
  color: ${(props) => (props.isUser ? "#111111" : "#1c1c1e")};
  position: relative;
  word-break: break-all;
  p {
    font-family: PingFang SC;
    font-size: 14px;
    font-weight: normal;
    line-height: 22px;
    letter-spacing: 0px;
    color: #111111;
    margin: 0;
    padding: 8px 12px;
  }
`;

// Add a new styled component for our modern typing indicator
const StreamingIndicator = styled.div`
  position: absolute;
  bottom: 10px;
  left: 0;
  display: ${(props) => (props.isVisible ? "flex" : "none")};
  align-items: center;
  justify-content: space-around;
  gap: 4px;
  width: 50px;

  .star {
    font-size: 10px;
    display: inline-block;
    color: ${(props) =>
      props.isUser ? "rgba(255, 255, 255, 0.9)" : "#4CAF50"};
    filter: drop-shadow(
      0 0 1px
        ${(props) =>
          props.isUser ? "rgba(255, 255, 255, 0.5)" : "rgba(76, 175, 80, 0.5)"}
    );
  }

  .star:nth-child(1) {
    animation: spin 1.8s infinite 0.2s;
  }
  .star:nth-child(2) {
    animation: spin 1.8s infinite 0.6s;
  }
  .star:nth-child(3) {
    animation: spin 1.8s infinite 1s;
  }

  @keyframes spin {
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

// 添加思考状态的样式组件
const ThinkingContainer = styled.div`
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 12px 16px;
  margin: 8px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-style: italic;
  color: #6c757d;
  font-size: 0.75rem;
  position: relative;
  overflow: hidden;

  ${(props) =>
    props.isActive &&
    `
    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    border-color: #2196f3;
    color: #1976d2;
    animation: pulse 1.5s infinite ease-in-out;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(33, 150, 243, 0.3), transparent);
      animation: shimmer 2s infinite;
    }
  `}

  @keyframes shimmer {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
    }
  }
`;

// 添加一个新的样式用于工具调用消息
const ToolCallContent = styled(MessageContent)`
  background: #f7f8fa !important;
  font-family: monospace;
  font-size: 0.9rem;
  box-shadow: none;
  padding: 0px 12px;
  border-radius: 8px;
`;

// 工具调用详情样式
const ToolCallDetails = styled.div`
  padding: 4px 0;
  margin: 6px 0;
  font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
  font-size: 0.8rem;
`;

const ToolCallHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  min-width: 250px;
`;

const ToolName = styled.span`
  background: #007aff;
  color: white;
  padding: 3px 6px;
  border-radius: 3px;
  font-weight: 500;
  font-size: 0.7rem;
`;

const ToolId = styled.span`
  color: #6c757d;
  font-size: 0.65rem;
  font-family: monospace;
`;

// 列表式参数显示容器
const ToolArgsContainer = styled.div`
  padding: 4px 0;
  margin: 4px 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
`;

// 参数列表项
const ToolArgItem = styled.div`
  display: flex;
  align-items: center;
  padding: 3px 0;
  font-size: 0.75rem;
  line-height: 1.3;

  &:last-child {
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }
`;

// 列表项前缀（圆点）
const ToolArgBullet = styled.span`
  color: #007aff;
  margin-right: 8px;
  margin-top: 2px;
  flex-shrink: 0;
  font-weight: bold;
`;

// 参数名称
const ToolArgKey = styled.span`
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  text-align: right;
  letter-spacing: 0px;
  color: #1e293b;
`;

// 参数值
const ToolArgValue = styled.span`
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: normal;
  line-height: 22px;
  letter-spacing: 0px;
  color: #6e7b8d;
  margin-left: 5px;
`;

const ToolCallButtons = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 8px;
  justify-content: center;
`;

const ConfirmButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 14px;
  width: 80px;

  &:hover {
    background: #218838;
    transform: translateY(-0.5px);
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
  }
`;

const CancelButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 14px;
  width: 80px;
  margin-left: 4px;
  &:hover {
    background: #c82333;
    transform: translateY(-0.5px);
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
  }
`;

const ToolCallStatusBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  margin-top: 6px;
  line-height: 22px;
  letter-spacing: 0px;
  font-family: PingFang SC;
  ${(props) =>
    props.status === "confirmed" &&
    `
    background: #D1FAE5;
    color: #10B981;
  `}
  ${(props) =>
    props.status === "cancelled" &&
    `
    background: #f8d7da;
    color: #721c24;
  `};
`;

// JSON格式化显示样式
const JSONContainer = styled.div`
  position: relative;
  margin: 8px 0;
`;

const JSONContent = styled.pre`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  font-family: "SF Mono", Monaco, "Cascadia Code", "Consolas", monospace;
  font-size: 0.85rem;
  line-height: 1.4;
  color: #2c3e50;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #ccc;
  }
`;

const JSONLabel = styled.div`
  position: absolute;
  top: -8px;
  right: 8px;
  background: #007aff;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  z-index: 1;
`;

const ViewToggleButton = styled.button`
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.7rem;
  color: #6c757d;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 1;

  &:hover {
    background: white;
    border-color: #adb5bd;
  }
`;

const Message = ({ message, messageId }) => {
  const {
    content,
    code,
    isUser,
    isToolCall,
    isStreaming,
    isThinking,
    thinkContentList,
    activeThinkIndex,
    toolCall,
    toolCalls,
    toolCallStatus,
    toolCallStatuses,
    isJSON,
    isPureJSON,
    jsonBlocks,
    originalContent,
  } = message;

  // 检查消息是否有实际内容，避免渲染空的消息框
  const hasContent =
    content ||
    code ||
    (toolCalls && toolCalls.length > 0) ||
    toolCall ||
    (thinkContentList && thinkContentList.length > 0) ||
    isStreaming; // 正在流式传输的消息应该显示

  // 如果没有任何内容，不渲染消息
  if (!hasContent) {
    return null;
  }
  const {
    confirmToolCall,
    cancelToolCall,
    confirmSingleToolCall,
    cancelSingleToolCall,
    isLoading,
    isProcessingToolCalls,
  } = useContext(ChatContext);
  const [showOriginalJSON, setShowOriginalJSON] = useState(false);

  // JSON 显示相关状态
  const [jsonCollapsed, setJsonCollapsed] = useState({}); // 用对象存储每个JSON块的收起状态

  // 列表式参数显示渲染函数
  const renderToolArgs = (args) => {
    if (!args || typeof args !== "object") {
      return null;
    }

    return (
      <ToolArgsContainer>
        {Object.entries(args)
          .filter(([key]) => key !== "reason")
          .map(([key, value]) => (
            <ToolArgItem key={key}>
              <ToolArgBullet>•</ToolArgBullet>
              <ToolArgKey>{key}:</ToolArgKey>
              <ToolArgValue>{String(value)}</ToolArgValue>
            </ToolArgItem>
          ))}
      </ToolArgsContainer>
    );
  };

  // 初始化 JSON 块为收起状态
  useEffect(() => {
    if (isPureJSON) {
      // 纯 JSON 默认收起
      setJsonCollapsed((prev) => ({ ...prev, pure: true }));
    } else if (jsonBlocks && jsonBlocks.length > 0) {
      // 所有 JSON 块默认收起
      const collapsedState = {};
      jsonBlocks.forEach((block) => {
        collapsedState[block.id] = true;
      });
      setJsonCollapsed((prev) => ({ ...prev, ...collapsedState }));
    }

    // 为执行结果初始化折叠状态（根据数据类型决定）
    if (message.isToolMessage && content) {
      try {
        const parsedJson = JSON.parse(content);
        let shouldCollapse = true; // 默认收起

        // 检查数据结构类型
        if (
          parsedJson.hasOwnProperty("@odata.context") &&
          parsedJson.hasOwnProperty("value")
        ) {
          // 直接的OData格式：{"@odata.context": ..., "value": [...]} → 默认展开
          shouldCollapse = false;
        } else if (
          parsedJson.hasOwnProperty("status") &&
          parsedJson.hasOwnProperty("data")
        ) {
          // 嵌套格式：{"status": "success", "data": {...}} → 默认收起
          shouldCollapse = true;
        }

        setJsonCollapsed((prev) => ({
          ...prev,
          pure: shouldCollapse,
          execution: shouldCollapse,
        }));
      } catch (e) {
        // 解析失败，默认收起
        setJsonCollapsed((prev) => ({
          ...prev,
          pure: true,
          execution: true,
        }));
      }
    }
  }, [isPureJSON, jsonBlocks, message.isToolMessage, content]);

  // JSON 语法高亮函数
  const highlightJson = (jsonString) => {
    return jsonString
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1":</span>')
      .replace(/:\s*"([^"]*)"/g, ': <span class="json-string">"$1"</span>')
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
      .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
      .replace(/:\s*null/g, ': <span class="json-null">null</span>');
  };

  // 复制 JSON 到剪贴板
  const copyJsonToClipboard = async (jsonText) => {
    try {
      await navigator.clipboard.writeText(jsonText);
      console.log("JSON 已复制到剪贴板");
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  // 切换 JSON 块的展开/收起状态
  const toggleJsonBlock = (blockId) => {
    setJsonCollapsed((prev) => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));
  };

  // 检测是否为执行结果数据
  const isExecutionResult = (jsonData) => {
    if (typeof jsonData !== "object" || jsonData === null) return false;

    // 检查是否具有执行结果的典型结构：status, code, data
    const hasStatusCodeData =
      jsonData.hasOwnProperty("status") &&
      jsonData.hasOwnProperty("code") &&
      jsonData.hasOwnProperty("data") &&
      typeof jsonData.status === "string" &&
      typeof jsonData.code === "number" &&
      typeof jsonData.data === "object" &&
      jsonData.data !== null;

    // 检查是否为OData格式：@odata.context + value数组
    const hasODataStructure =
      jsonData.hasOwnProperty("@odata.context") &&
      jsonData.hasOwnProperty("value") &&
      Array.isArray(jsonData.value) &&
      jsonData.value.length > 0;

    return hasStatusCodeData || hasODataStructure;
  };

  // 字段名中文翻译映射
  const fieldNameTranslations = {
    // 零件属性
    name: "名称",
    code: "编号",
    description: "描述",
    submitDescription: "提交描述",
    partType: "类型",
    volume: "体积",
    mass: "质量",
    createdAt: "创建时间",
    modifiedAt: "修改时间",
    lifecycleState: "生命周期状态",
    lifecycleNote: "生命周期备注",
    schemaVersion: "架构版本",
    material: "材料",
    openSurfaceArea: "开放面面积",
    solidSurfaceArea: "实体面面积",
    gravityCenter: "重心",
    code: "编号",
    ncid: "ID",
    "@odata.type": "数据类型",
    "@odata.context": "数据上下文",
    "@odata.count": "总数量",
    total_count: "总数量",

    // 导航属性
    version: "版本",
    owner: "所有者",
    lifecycleStatus: "生命周期状态",
    thumbnail: "缩略图",
  };

  // 获取字段的中文名称
  const getFieldDisplayName = (fieldName) => {
    return fieldNameTranslations[fieldName] || fieldName;
  };

  // 渲染执行结果 - 可折叠的简洁展示
  const renderExecutionResult = (jsonData, blockId = "execution") => {
    // 判断数据类型并提取相应数据
    let displayData,
      status,
      isOData = false,
      isArray = false,
      arrayLength = 0;

    if (
      jsonData.hasOwnProperty("@odata.context") &&
      jsonData.hasOwnProperty("value")
    ) {
      // OData格式
      isOData = true;
      isArray = Array.isArray(jsonData.value);
      arrayLength = isArray ? jsonData.value.length : 0;

      if (isArray && arrayLength > 0) {
        // 如果是数组，取第一个对象作为预览，但保留完整数组用于表格渲染
        displayData = jsonData.value[0] || {};
      } else {
        displayData = jsonData.value || {};
      }
      status = "success";
    } else {
      // 标准执行结果格式
      status = jsonData.status;
      displayData = jsonData.data;
    }

    // 提取关键字段用于预览
    const keyFields = [
      "name",
      "code",
      "ncid",
      "id",
      "title",
      "type",
      "partType",
    ];
    const previewData = {};

    Object.entries(displayData).forEach(([key, value]) => {
      if (
        key !== "@odata.type" &&
        keyFields.some((field) =>
          key.toLowerCase().includes(field.toLowerCase())
        )
      ) {
        previewData[key] = value;
      }
    });

    // 对于数组数据，总是显示展开按钮
    const hasMoreData = isArray || Object.keys(displayData).length > 3;
    // 数组数据也支持展开/收起，根据折叠状态决定
    const isExpanded = !jsonCollapsed[blockId];

    return (
      <CleanExecutionResult key={`execution-${blockId}`}>
        {/* 头部 - 带展开/收起按钮 */}
        <CollapsibleResultHeader>
          {/* <ResultBadge status={status}>
            {message.toolName || "相关数据"}
          </ResultBadge> */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minWidth: "250px",
              background: "#E2E8F0",
              padding: "5px 10px",
              width: "100%",
              fontFamily: "PingFang SC",
              fontSize: "12px",
              fontWeight: 500,
              lineHeight: "22px",
              letterSpacing: "0px",
            }}
          >
            <span>{message.toolName || "相关数据"}</span>
            {(hasMoreData || isArray) && (
              <ExpandButton
                onClick={() => toggleJsonBlock(blockId)}
                title={isExpanded ? "收起详细信息" : "展开详细信息"}
                style={{}}
              >
                {/* <img
                  src={isExpanded ? Collapse : Expand}
                  alt="展开"
                  style={{
                    width: "14px",
                    height: "14px",
                    fill: "#7F8C9F",
                  }}
                /> */}
                {isExpanded ? (
                  <img
                    src={Collapse}
                    alt="展开"
                    style={{
                      width: "12.67px",
                      height: "12.67px",
                      marginTop: "2.5px",
                      fill: "#7F8C9F",
                    }}
                  />
                ) : (
                  <img
                    src={Expand}
                    alt="展开"
                    style={{
                      width: "12.67px",
                      height: "12.67px",

                      fill: "#7F8C9F",
                    }}
                  />
                )}
                {isExpanded ? "收起" : "展开"}
              </ExpandButton>
            )}
          </div>
        </CollapsibleResultHeader>

        {/* 关键信息预览 - 只在非数组时显示 */}
        {!isArray && Object.keys(previewData).length > 0 && (
          <CompactPreview>
            {/* 显示第一个对象的关键字段 */}
            {Object.entries(previewData)
              .filter(([key]) => key !== "@odata.type")
              .sort(([a], [b]) => {
                // 名称排最前，NCID排最后
                if (a === "name") return -1;
                if (b === "name") return 1;
                if (a === "ncid") return 1;
                if (b === "ncid") return -1;
                return 0;
              })
              .slice(0, 3)
              .map(([key, value]) => (
                <ToolArgItem key={key}>
                  <ToolArgBullet>•</ToolArgBullet>
                  <ToolArgKey>{getFieldDisplayName(key)}:</ToolArgKey>
                  <ToolArgValue>
                    {typeof value === "string" && value.length > 30
                      ? `${value.substring(0, 30)}...`
                      : String(value)}
                  </ToolArgValue>
                </ToolArgItem>
              ))}
            {hasMoreData && <PreviewMore>...</PreviewMore>}
          </CompactPreview>
        )}

        {/* 展开时显示完整表格 */}
        {isExpanded && (
          <CleanTableContainer>
            {isArray ? (
              // 数组格式：字段名作为列标题，每条数据作为一行
              <CleanDataTable>
                <thead>
                  <tr>
                    {Object.keys(jsonData.value[0] || {})
                      .filter((key) => key !== "@odata.type")
                      .sort((a, b) => {
                        // 名称排最前，NCID排最后
                        if (a === "name") return -1;
                        if (b === "name") return 1;
                        if (a === "ncid") return 1;
                        if (b === "ncid") return -1;
                        return 0;
                      })
                      .map((key) => (
                        <th key={key} className="field-header">
                          {getFieldDisplayName(key)}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {jsonData.value.map((item, index) => (
                    <tr key={index} className="data-row">
                      {Object.keys(jsonData.value[0] || {})
                        .filter((key) => key !== "@odata.type")
                        .sort((a, b) => {
                          // 名称排最前，NCID排最后
                          if (a === "name") return -1;
                          if (b === "name") return 1;
                          if (a === "ncid") return 1;
                          if (b === "ncid") return -1;
                          return 0;
                        })
                        .map((key) => (
                          <td key={key} className="field-cell">
                            {item[key] === null ? (
                              <span className="null-value">null</span>
                            ) : typeof item[key] === "object" ? (
                              <span className="object-value">
                                {JSON.stringify(item[key])}
                              </span>
                            ) : typeof item[key] === "boolean" ? (
                              <span className={`boolean-value ${item[key]}`}>
                                {String(item[key])}
                              </span>
                            ) : typeof item[key] === "number" ? (
                              <span className="number-value">{item[key]}</span>
                            ) : (
                              <span
                                className="string-value"
                                title={String(item[key])}
                              >
                                {key === "ncid" || key === "@odata.context"
                                  ? String(item[key]).length > 30
                                    ? String(item[key]).substring(0, 30) + "..."
                                    : String(item[key])
                                  : String(item[key])}
                              </span>
                            )}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </CleanDataTable>
            ) : (
              // 单个对象格式：显示单个对象的字段
              <CleanDataTable>
                <thead>
                  <tr>
                    <th>字段</th>
                    <th>值</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(displayData).map(([key, value]) => (
                    <tr key={key}>
                      <td className="field-name">{getFieldDisplayName(key)}</td>
                      <td className="field-value">
                        {value === null ? (
                          <span className="null-value">null</span>
                        ) : typeof value === "object" ? (
                          <span className="object-value">
                            {JSON.stringify(value)}
                          </span>
                        ) : typeof value === "boolean" ? (
                          <span className={`boolean-value ${value}`}>
                            {String(value)}
                          </span>
                        ) : typeof value === "number" ? (
                          <span className="number-value">{value}</span>
                        ) : (
                          <span className="string-value">{String(value)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </CleanDataTable>
            )}
          </CleanTableContainer>
        )}
      </CleanExecutionResult>
    );
  };

  // 渲染混合内容（文字 + JSON）
  const renderMixedContent = () => {
    if (isPureJSON) {
      // 纯 JSON 内容 - 检查是否为执行结果
      const isToolMessage = message.isToolMessage;
      console.log("[RENDER_DEBUG] 渲染纯JSON:", {
        isToolMessage,
        messageId: message.id,
        content: message.content?.substring(0, 100),
      });

      // 如果是工具消息，检查是否所有相关工具调用都被取消了
      if (isToolMessage && message.toolCalls && message.toolCallStatuses) {
        const allCancelled = message.toolCalls.every(
          (tool) => message.toolCallStatuses[tool.tool_call_id] === "cancelled"
        );
        if (allCancelled) {
          console.log(
            "[RENDER_DEBUG] 所有工具调用都被取消，不显示工具调用结果"
          );
          return null;
        }
      }

      // 尝试解析JSON并检查是否为执行结果
      let parsedJson = null;
      try {
        parsedJson = JSON.parse(content);
      } catch (e) {
        // JSON解析失败，使用原有渲染方式
      }

      // 如果是工具消息，检查状态
      if (isToolMessage && parsedJson) {
        // 如果状态是 cancelled，不显示
        if (parsedJson.status === "cancelled") {
          console.log("[RENDER_DEBUG] 工具消息状态为 cancelled，不显示");
          return null;
        }

        // 如果符合执行结果格式，使用专门的表格渲染
        if (isExecutionResult(parsedJson)) {
          console.log("[RENDER_DEBUG] 检测到执行结果，使用表格渲染");
          return renderExecutionResult(parsedJson, "pure");
        }
      }

      // 如果是工具消息，不渲染任何内容
      if (isToolMessage) {
        return null;
      }

      // 否则使用原有的JSON渲染方式
      const ViewerComponent = JsonViewer;
      const HeaderComponent = JsonHeader;
      const iconEmoji = "📄";
      const labelText = "相关数据";

      return (
        <ViewerComponent>
          <HeaderComponent>
            <div className="json-label">
              <span>{iconEmoji}</span>
              <span>{labelText}</span>
            </div>
            <div className="json-controls">
              <JsonButton
                onClick={() => toggleJsonBlock("pure")}
                title={jsonCollapsed["pure"] ? "展开" : "收起"}
              >
                {jsonCollapsed["pure"] ? "展开" : "收起"}
              </JsonButton>
            </div>
          </HeaderComponent>
          <JsonContent
            collapsed={jsonCollapsed["pure"]}
            dangerouslySetInnerHTML={{
              __html: `<pre>${highlightJson(content)}</pre>`,
            }}
          />
        </ViewerComponent>
      );
    }

    if (jsonBlocks && jsonBlocks.length > 0) {
      // 混合内容（文字 + JSON 块）
      let contentWithReplacements = content;
      const jsonComponents = [];

      // 如果是工具消息，检查是否所有相关工具调用都被取消了
      if (
        message.isToolMessage &&
        message.toolCalls &&
        message.toolCallStatuses
      ) {
        const allCancelled = message.toolCalls.every(
          (tool) => message.toolCallStatuses[tool.tool_call_id] === "cancelled"
        );
        if (allCancelled) {
          console.log(
            "[RENDER_DEBUG] 混合内容中所有工具调用都被取消，不显示工具调用结果"
          );
          return null; // 直接返回，不显示任何内容
        }
      }

      jsonBlocks.forEach((block, index) => {
        const isCollapsed = jsonCollapsed[block.id];
        const isToolMessage = message.isToolMessage;

        // 尝试解析JSON并检查是否为执行结果
        let parsedBlockJson = null;
        try {
          parsedBlockJson = JSON.parse(block.formatted);
        } catch (e) {
          // JSON解析失败，使用原有渲染方式
        }

        // 如果是工具消息，跳过渲染
        if (isToolMessage) {
          return; // 在 forEach 中使用 return 跳过当前迭代
        }

        // 非工具消息的JSON渲染
        jsonComponent = (
          <JsonViewer key={block.id} className="json-block">
            <JsonHeader>
              <div className="json-label">
                <span>📋</span>
                <span>相关数据</span>
              </div>
              <div className="json-controls">
                <JsonButton
                  onClick={() => toggleJsonBlock(block.id)}
                  title={isCollapsed ? "展开" : "收起"}
                >
                  {isCollapsed ? "展开" : "收起"}
                </JsonButton>
              </div>
            </JsonHeader>
            <JsonContent
              collapsed={isCollapsed}
              dangerouslySetInnerHTML={{
                __html: `<pre>${highlightJson(block.formatted)}</pre>`,
              }}
            />
          </JsonViewer>
        );

        jsonComponents.push(jsonComponent);
        contentWithReplacements = contentWithReplacements.replace(
          block.id,
          `__COMPONENT_${index}__`
        );
      });

      // 将内容分割并插入 JSON 组件
      const parts = contentWithReplacements.split(/(__COMPONENT_\d+__)/);

      return (
        <MixedContent>
          {parts.map((part, index) => {
            const componentMatch = part.match(/^__COMPONENT_(\d+)__$/);
            if (componentMatch) {
              const componentIndex = parseInt(componentMatch[1]);
              return jsonComponents[componentIndex];
            } else if (part.trim()) {
              return (
                <div key={`text-${index}`} className="text-content">
                  <ReactMarkdown>{part}</ReactMarkdown>
                </div>
              );
            }
            return null;
          })}
        </MixedContent>
      );
    }

    // 普通文本内容
    return <ReactMarkdown>{content}</ReactMarkdown>;
  };

  // 渲染单个工具调用
  const renderSingleToolCall = (toolCall, toolCallStatus) => (
    <ToolCallDetails key={toolCall.tool_call_id || toolCall.tool_id}>
      <ToolCallHeader>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#E2E8F0",
            padding: "5px 10px",
            width: "100%",
            fontFamily: "PingFang SC",
            fontSize: "12px",
            fontWeight: 500,
            lineHeight: "22px",
            letterSpacing: "0px",
          }}
        >
          <span>
            {toolCall?.tool_call_name || toolCall?.tool_name || "Unknown Tool"}
          </span>
        </div>
        {/* <ToolName>
          {toolCall?.tool_call_name || toolCall?.tool_name || "Unknown Tool"}
        </ToolName> */}
      </ToolCallHeader>
      <div style={{ border: "1px solid #E2E8F0", width: "100%" }}></div>
      {renderToolArgs(toolCall?.tool_call_args || toolCall?.tool_args)}
      <div
        style={{
          border: "1px solid #E2E8F0",
          width: "100%",
          marginBottom: "3px",
        }}
      ></div>
      {!toolCallStatus && !message.isToolCallReadOnly && (
        <ToolCallButtons>
          <ConfirmButton
            onClick={() =>
              confirmSingleToolCall(toolCall.tool_call_id || toolCall.tool_id)
            }
            disabled={isLoading || isProcessingToolCalls}
          >
            ✓ 确认
          </ConfirmButton>
          <CancelButton
            onClick={() =>
              cancelSingleToolCall(toolCall.tool_call_id || toolCall.tool_id)
            }
            disabled={isLoading || isProcessingToolCalls}
          >
            ✕ 取消
          </CancelButton>
        </ToolCallButtons>
      )}
      <div style={{ display: "flex", justifyContent: "center" }}>
        {toolCallStatus && (
          <ToolCallStatusBadge status={toolCallStatus}>
            {toolCallStatus === "confirmed" ? (
              <>✓ 已确认执行</>
            ) : toolCallStatus === "cancelled" ? (
              <>✕ 已取消</>
            ) : (
              <>⏳ 处理中...</>
            )}
          </ToolCallStatusBadge>
        )}
      </div>
    </ToolCallDetails>
  );

  // 检查是否所有工具调用都已完成
  const getAllToolCallsStatus = () => {
    if (!toolCalls || toolCalls.length === 0) return null;

    const allCompleted = toolCalls.every(
      (tool) =>
        toolCallStatuses?.[tool.tool_call_id] === "confirmed" ||
        toolCallStatuses?.[tool.tool_call_id] === "cancelled"
    );

    if (allCompleted) {
      const confirmedCount = toolCalls.filter(
        (tool) => toolCallStatuses?.[tool.tool_call_id] === "confirmed"
      ).length;
      const cancelledCount = toolCalls.filter(
        (tool) => toolCallStatuses?.[tool.tool_call_id] === "cancelled"
      ).length;

      return {
        completed: true,
        confirmed: confirmedCount,
        cancelled: cancelledCount,
        total: toolCalls.length,
      };
    }

    return { completed: false };
  };

  const allToolCallsStatus = getAllToolCallsStatus();

  return (
    <MessageContainer
      isUser={isUser}
      style={
        isToolCall || message.isToolMessage
          ? { background: "#ffffff", borderRadius: "12px", padding: "0" }
          : {}
      }
    >
      {isToolCall ? (
        <ToolCallContent isUser={isUser}>
          {/* 支持多个工具调用 */}
          {toolCalls && toolCalls.length > 0 ? (
            <>
              {/* 渲染多个工具调用 */}
              {toolCalls.map((tool) =>
                renderSingleToolCall(
                  tool,
                  toolCallStatuses?.[tool.tool_call_id]
                )
              )}
            </>
          ) : toolCall ? (
            // 兼容旧格式：单个工具调用
            renderSingleToolCall(toolCall, toolCallStatus)
          ) : (
            <div>无效的工具调用数据</div>
          )}
        </ToolCallContent>
      ) : (
        <MessageContent
          isUser={isUser}
          style={
            message.isToolMessage
              ? {
                  background: "#ffffff !important",
                  boxShadow: "none",
                  border: "none",
                  padding: "0",
                }
              : {}
          }
        >
          {/* 显示思考状态 */}
          {thinkContentList && thinkContentList.length > 0 && (
            <div>
              {thinkContentList.map((thinkContent, index) => {
                // 只有当前活跃的think索引才显示动画
                const isActive = activeThinkIndex === index;
                return (
                  <ThinkingContainer key={index} isActive={isActive}>
                    <span>{thinkContent}</span>
                  </ThinkingContainer>
                );
              })}
            </div>
          )}
          {content &&
            (() => {
              console.log("[DEBUG] 渲染消息内容:", {
                content: content?.substring(0, 200),
                isToolMessage: message.isToolMessage,
                toolCalls: message.toolCalls,
                toolCallStatuses: message.toolCallStatuses,
              });
              return renderMixedContent();
            })()}

          <StreamingIndicator
            isVisible={
              isStreaming &&
              (!thinkContentList || thinkContentList.length === 0)
            }
            isUser={isUser}
          >
            <span className="star">●</span>
            <span className="star">●</span>
            <span className="star">●</span>
          </StreamingIndicator>
          {/* 取消 Three.js 视图渲染 */}
        </MessageContent>
      )}
    </MessageContainer>
  );
};

// 添加控制按钮的样式
const ControlsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  justify-content: center;
`;

const ControlButton = styled.button`
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;

  &:hover {
    background: #e0e0e0;
  }
`;

// JSON 显示组件
const JsonViewer = styled.div`
  margin: 0.75rem 0;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
`;

// 执行结果显示组件（特殊样式）
const ToolMessageViewer = styled.div`
  margin: 4px 0;
  border: 1px solid #10b981;
  border-radius: 6px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: none;
`;

const JsonHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: #e9ecef;
  border-bottom: 1px solid #dee2e6;
  font-size: 0.85rem;
  font-weight: 500;
  color: #495057;

  .json-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .json-controls {
    display: flex;
    gap: 0.25rem;
  }
`;

// 执行结果头部样式
const ToolMessageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f0fdf4;
  border-bottom: none;
  font-size: 0.75rem;
  font-weight: 500;
  color: #166534;

  .json-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .json-controls {
    display: flex;
    gap: 0.25rem;
  }
`;

const JsonContent = styled.div`
  padding: ${(props) => (props.collapsed ? "0" : "0.75rem")};
  max-height: ${(props) => (props.collapsed ? "0" : "400px")};
  overflow: ${(props) => (props.collapsed ? "hidden" : "auto")};
  transition: all 0.3s ease;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 0.85rem;
  line-height: 1.4;
  background: #ffffff;
  border-top: 1px solid #10b981;

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* JSON 语法高亮 */
  .json-key {
    color: #0066cc;
    font-weight: 500;
  }

  .json-string {
    color: #008000;
  }

  .json-number {
    color: #ff6600;
  }

  .json-boolean {
    color: #cc0066;
    font-weight: bold;
  }

  .json-null {
    color: #999999;
    font-style: italic;
  }
`;

const JsonButton = styled.button`
  background: none;
  border: 1px solid #ddd;
  color: #666;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 500;

  &:hover {
    background: #f0f0f0;
    border-color: #bbb;
  }

  &:active {
    background: #e0e0e0;
  }
`;

const MixedContent = styled.div`
  .text-content {
    margin-bottom: 0.75rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .json-block {
    margin: 0.75rem 0;

    &:first-child {
      margin-top: 0;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }
`;

// 执行结果表格样式组件
const ExecutionResultViewer = styled.div`
  margin: 0.75rem 0;
  border: 1px solid #10b981;
  border-radius: 8px;
  overflow: hidden;
  background: #f0fdf4;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);
`;

const ExecutionResultHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border-bottom: 1px solid #bbf7d0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #166534;

  .result-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
  }

  .result-status {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .result-controls {
    display: flex;
    gap: 0.25rem;
  }
`;

const StatusBadge = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${(props) => {
    if (props.status === "success") return "#10b981";
    if (props.status === "error") return "#ef4444";
    if (props.status === "warning") return "#f59e0b";
    return "#6b7280";
  }};
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const TableContainer = styled.div`
  padding: 1rem;
  background: #ffffff;
  max-height: 400px;
  overflow-y: auto;
`;

const DataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;

  th {
    background: #f8fafc;
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 2px solid #e5e7eb;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  td {
    padding: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }

  tr:hover {
    background: #f9fafb;
  }

  .field-name {
    font-weight: 500;
    color: #374151;
    width: 30%;
    min-width: 120px;
  }

  .field-value {
    color: #6b7280;
    word-break: break-word;

    .null-value {
      color: #9ca3af;
      font-style: italic;
    }

    .string-value {
      color: #059669;
    }

    .number-value {
      color: #dc2626;
      font-weight: 500;
    }

    .boolean-value {
      font-weight: 600;

      &.true {
        color: #059669;
      }

      &.false {
        color: #dc2626;
      }
    }

    .object-value {
      color: #7c3aed;
      font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
      font-size: 0.8rem;
      background: #f3f4f6;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
      max-width: 100%;
      overflow-x: auto;
    }
  }

  /* 新的表格数据展示样式 */
  .data-row {
    border-bottom: 1px solid #f3f4f6;

    &:last-child {
      border-bottom: none;
    }
  }

  .row-index {
    width: 60px;
    text-align: center;
    font-weight: 600;
    color: #6b7280;
    background: #f9fafb;
    border-right: 1px solid #e5e7eb;
  }

  .field-header {
    background: #f8fafc;
    font-weight: 600;
    color: #374151;
    text-align: center;
    padding: 12px 8px;
    border-bottom: 2px solid #e5e7eb;
    min-width: 120px;
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .field-cell {
    padding: 12px 8px;
    text-align: left;
    vertical-align: middle;
    border-right: 1px solid #f3f4f6;
    max-width: 200px;
    word-break: break-word;
    overflow-wrap: break-word;

    &:last-child {
      border-right: none;
    }
  }
`;

// 简洁风格的执行结果样式组件
const SimpleExecutionResult = styled.div`
  padding: 6px 0;
  margin: 4px 0;
  font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
  font-size: 0.8rem;
`;

const SimpleResultHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
`;

const ResultBadge = styled.span`
  background: ${(props) => {
    if (props.status === "success") return "#28a745";
    if (props.status === "error") return "#dc3545";
    return "#ffc107";
  }};
  color: white;
  padding: 3px 6px;
  border-radius: 3px;
  font-weight: 500;
  font-size: 0.7rem;
`;

const ResultCode = styled.span`
  color: #6c757d;
  font-size: 0.65rem;
  font-family: monospace;
`;

const SimpleDataList = styled.div`
  padding: 4px 0;
  margin: 4px 0;
`;

const SimpleDataItem = styled.div`
  display: flex;
  align-items: flex-start;
  padding: 3px 0;
  font-size: 0.75rem;
  line-height: 1.3;

  &:last-child {
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }

  .key {
    color: #007aff;
    margin-right: 8px;
    min-width: 100px;
    font-weight: 500;
  }

  .value {
    color: #2c3e50;
    word-break: break-all;
    flex: 1;

    .null {
      color: #9ca3af;
      font-style: italic;
    }

    .string {
      color: #059669;
    }

    .number {
      color: #dc2626;
      font-weight: 500;
    }

    .boolean {
      font-weight: 600;

      &.true {
        color: #059669;
      }

      &.false {
        color: #dc2626;
      }
    }

    .object {
      color: #7c3aed;
      font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
      font-size: 0.7rem;
      background: #f3f4f6;
      padding: 2px 4px;
      border-radius: 2px;
      display: inline-block;
    }
  }
`;

// 清洁风格的执行结果样式组件 - 白色背景表格
const CleanExecutionResult = styled.div`
  background: #f7f8fa !important;
  border-radius: 6px;
  padding: 8px 12px;
  font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
  font-size: 0.75rem;
  position: relative;
  z-index: 1;
  box-shadow: none;
`;

const CleanResultHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 6px;
`;

// 可折叠头部
const CollapsibleResultHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

// 展开/收起按钮
const ExpandButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: right;
  gap: 3px;
  background: none;
  width: 80px;
  border-width: 0;
  color: #7f8c9f;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
`;

// 紧凑预览容器
const CompactPreview = styled.div`
  margin-bottom: 4px;
  font-size: 0.75rem;
`;

// 预览项
const PreviewItem = styled.div`
  display: flex;
  align-items: center;
  padding: 2px 0;

  .key {
    color: #374151;
    margin-right: 6px;
    min-width: 60px;
    font-weight: 500;
  }

  .value {
    color: #059669;
    flex: 1;
  }
`;

// 更多字段提示
const PreviewMore = styled.div`
  color: #9ca3af;
  font-size: 0.7rem;
  font-style: italic;
  padding: 2px 0;
`;

const CleanTableContainer = styled.div`
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  &::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 3px;
  }
`;

const CleanDataTable = styled.table`
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;

  th {
    background: #ffffff;
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.7rem;
  }

  td {
    padding: 6px 12px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }

  tr:hover {
    background: #f9fafb;
  }

  tr:last-child td {
    border-bottom: none;
  }

  .field-name {
    font-weight: 500;
    color: #374151;
    width: 30%;
    min-width: 100px;
  }

  .field-value {
    color: #6b7280;
    word-break: break-word;

    .null-value {
      color: #9ca3af;
      font-style: italic;
    }

    .string-value {
      color: #059669;
    }

    .number-value {
      color: #dc2626;
      font-weight: 500;
    }

    .boolean-value {
      font-weight: 600;

      &.true {
        color: #059669;
      }

      &.false {
        color: #dc2626;
      }
    }

    .object-value {
      color: #7c3aed;
      font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
      font-size: 0.7rem;
      background: #f3f4f6;
      padding: 2px 4px;
      border-radius: 2px;
      display: inline-block;
      max-width: 100%;
      overflow-x: auto;
    }
  }
`;

export default Message;
