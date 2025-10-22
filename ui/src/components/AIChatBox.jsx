import React, { useState, useRef, useEffect } from 'react';
import './AIChatBox.css';

const AIChatBox = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);



  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setLoading(true);

    try {
      const aiResponse = await mockApiResponse(input);
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="message-header">
              {message.role === 'user' ? '你' : 'AI'}
            </div>
            {message.content}
          </div>
        ))}
        {loading && (
          <div style={{ textAlign: 'center' }}>
            <div className="stars-container">
              <span className="star">★</span>
              <span className="star">★</span>
              <span className="star">★</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="please input..."
          className="chat-input"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()} className="chat-submit">
          {loading ? 'sending...' : 'send'}
        </button>
      </form>
    </div>
  );
};

export default AIChatBox; 