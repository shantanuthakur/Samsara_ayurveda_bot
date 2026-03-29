import React, { useRef, useEffect } from "react";
import { Send } from "lucide-react";
import "./ChatInput.css";

export default function ChatInput({ value, onChange, onSend, disabled }) {
    const textareaRef = useRef(null);

    // Auto-grow textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 140) + "px";
        }
    }, [value]);

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="chat-input-bar">
            <div className="input-wrapper">
                <textarea
                    ref={textareaRef}
                    className="chat-textarea"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about Ayurvedic remedies, diet, or wellness..."
                    rows={1}
                    id="chat-input"
                />
            </div>
            <button
                className="send-button"
                onClick={onSend}
                disabled={disabled || !value.trim()}
                aria-label="Send message"
                id="send-button"
            >
                <Send size={20} className="send-icon" />
            </button>
        </div>
    );
}
