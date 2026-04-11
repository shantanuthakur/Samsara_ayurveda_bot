import React from "react";
import { User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ChatMessage.css";

export function ChatMessage({ role, content }) {
    const isBot = role === "bot";
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
        <div className={`message-row ${role}`}>
            <div className={`msg-avatar ${isBot ? "bot-avatar" : "user-avatar"}`}>
                {isBot ? (
                    <img src="/monk.png" alt="AI Guru" />
                ) : (
                    <User size={18} />
                )}
            </div>

            <div>
                <div className="msg-bubble">
                    {isBot ? (
                        <div className="markdown-body">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                        </div>
                    ) : (
                        content
                    )}
                </div>
                <div className="msg-time">{time}</div>
            </div>
        </div>
    );
}

export function TypingIndicator() {
    return (
        <div className="message-row bot">
            <div className="msg-avatar bot-avatar">
                <img src="/monk.png" alt="AI Guru" />
            </div>
            <div>
                <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    );
}
