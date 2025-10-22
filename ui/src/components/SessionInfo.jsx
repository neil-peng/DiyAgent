import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import sessionManager from '../utils/sessionManager';

const SessionContainer = styled.div`
  background: #f0f0f0;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #666;
  font-family: monospace;
`;

const SessionLabel = styled.span`
  font-weight: bold;
  margin-right: 8px;
`;

const SessionId = styled.span`
  background: #e0e0e0;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
`;

const SessionInfo = () => {
  const [sessionId, setSessionId] = useState(sessionManager.getSessionId());

  useEffect(() => {
    // 监听URL变化，更新sessionId显示
    const handleUrlChange = () => {
      const currentSessionId = sessionManager.getSessionId();
      setSessionId(currentSessionId);
    };

    // 监听popstate事件（浏览器前进后退）
    window.addEventListener('popstate', handleUrlChange);

    // 监听自定义的sessionId变化事件
    window.addEventListener('sessionIdChanged', handleUrlChange);

    // 清理监听器
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('sessionIdChanged', handleUrlChange);
    };
  }, []);

  return (
    <SessionContainer>
      <SessionLabel>当前会话</SessionLabel>
      <br />
      <SessionId>{sessionId}</SessionId>
    </SessionContainer>
  );
};

export default SessionInfo; 