import React, { memo, useMemo } from "react";
import { User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ChatMessage.css";

const remarkPlugins = [remarkGfm];

/**
 * Finalized chat message — memoized so completed messages never re-render
 * when streaming content updates.
 */
export const ChatMessage = memo(function ChatMessage({ role, content }) {
    const isBot = role === "bot";
    const time = useMemo(
        () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [content]
    );

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
                            <ReactMarkdown remarkPlugins={remarkPlugins}>{content}</ReactMarkdown>
                        </div>
                    ) : (
                        content
                    )}
                </div>
                <div className="msg-time">{time}</div>
            </div>
        </div>
    );
});

/**
 * Streaming message — renders markdown live during streaming.
 * Performance is handled by rAF-throttled state updates in App.jsx,
 * so ReactMarkdown only re-renders at ~60fps max.
 */
export function StreamingMessage({ content }) {
    return (
        <div className="message-row bot streaming-message">
            <div className="msg-avatar bot-avatar">
                <img src="/monk.png" alt="AI Guru" />
            </div>

            <div>
                <div className="msg-bubble">
                    <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={remarkPlugins}>{content}</ReactMarkdown>
                        <span className="streaming-cursor" />
                    </div>
                </div>
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
