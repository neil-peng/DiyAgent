import React, { useEffect } from "react";
import styled from "@emotion/styled";
import { ChatProvider } from "./context/ChatContext";
import ChatInterface from "./components/ChatInterface";
import { getToken, setToken } from "./utils/utils";

//import "./App.css";
const AppLayout = styled.div`
  display: flex;
  height: 100vh;
  width: 100%;
  border-radius: 0 0 4px 4px;
`;

const ChatPanel = styled.div`
  flex: 1;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0px;
  border-radius: 0 0 4px 4px;
`;

function App() {
  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleMessage = (event) => {
    if (event.data.type === "start-drag") {
      document.addEventListener("mouseup", handleMouseUp);
    } else if (event.data.type === "stop-drag") {
      document.removeEventListener("mouseup", handleMouseUp);
    }
  };

  const handleMouseUp = () => {
    window.parent.postMessage({ type: "mouseup" }, "*");
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    console.log("tokenParam", tokenParam);
    if (getToken() && tokenParam) {
      urlParams.delete("token");
      const newSearch = urlParams.toString();
      const newUrl =
        window.location.pathname + (newSearch ? "?" + newSearch : "");
      window.history.replaceState({}, document.title, newUrl);
      setToken(tokenParam);
      return;
    }

    if (tokenParam) {
      setToken(tokenParam);
    }

    if (!getToken() && !tokenParam) {
      message.error("缺少访问令牌(token)，请在URL中添加token参数", "错误");
    }
  }, []);
  return (
    <AppLayout>
      <ChatPanel>
        {/* <h1
          style={{
            textAlign: "center",
            marginBottom: "0.75rem",
            fontSize: "1.75rem",
            marginTop: "0.75rem",
          }}
        ></h1> */}
        <ChatProvider>
          <ChatInterface />
        </ChatProvider>
      </ChatPanel>
    </AppLayout>
  );
}

export default App;
