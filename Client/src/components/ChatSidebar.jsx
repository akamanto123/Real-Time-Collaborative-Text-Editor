import React, { useState, useEffect, useRef } from 'react';

const ChatSidebar = ({ documentId, socket, currentUsername }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!socket || !documentId) return;

        const handleChatMessage = (msg) => {
            setMessages(prev => [...prev, msg]);
        };

        socket.on('chat-message', handleChatMessage);

        return () => {
            socket.off('chat-message', handleChatMessage);
        };
    }, [socket, documentId]);

    // Tự động cuộn xuống tin nhắn mới nhất
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        const text = input.trim();
        if (!text) return;

        socket.emit('send-chat-message', { documentId, text });
        setInput('');
    };

    return (
        <div className="chat-sidebar">
            <div className="sidebar-title">
                <h4>💬 Trò chuyện cộng tác</h4>
            </div>

            <div className="chat-messages-container">
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        <span className="chat-empty-icon">💬</span>
                        <p>Bắt đầu cuộc hội thoại với những người cùng chỉnh sửa tài liệu này!</p>
                    </div>
                ) : (
                    <div className="chat-messages-list">
                        {messages.map((msg, i) => {
                            const isMe = msg.username === currentUsername;
                            return (
                                <div key={i} className={`chat-message-item ${isMe ? 'message-me' : 'message-other'}`}>
                                    {!isMe && (
                                        <div className="chat-msg-sender" style={{ color: msg.color }}>
                                            {msg.username}
                                        </div>
                                    )}
                                    <div 
                                        className="chat-msg-bubble" 
                                        style={isMe ? {} : { borderLeft: `3px solid ${msg.color}` }}
                                    >
                                        <div className="chat-msg-text">{msg.text}</div>
                                        <div className="chat-msg-time">{msg.time}</div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <form onSubmit={handleSend} className="chat-input-form">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                    className="chat-text-input"
                />
                <button type="submit" className="btn btn-send-chat">Gửi</button>
            </form>
        </div>
    );
};

export default ChatSidebar;
