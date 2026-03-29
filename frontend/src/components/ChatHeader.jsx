import React from "react";
import { UserCircle } from "lucide-react";
import "./ChatHeader.css";

const BOT_NAME = "AI Guru";

export default function ChatHeader({ onToggleProfile }) {
    return (
        <header className="chat-header" id="chat-header">
            <div className="header-left">
                <img src="/monk.png" className="bot-avatar-header" alt="AI Guru" />
                <div className="header-info">
                    <h1 className="header-title">{BOT_NAME}</h1>
                    <span className="header-subtitle">
                        <span className="online-dot" aria-hidden="true"></span>
                        Ayurvedic AI Advisor
                    </span>
                </div>
            </div>

            <div className="header-actions">
                <button
                    className="profile-toggle-btn"
                    onClick={onToggleProfile}
                    aria-label="Open patient profile"
                    id="profile-toggle-btn"
                >
                    <UserCircle size={22} />
                </button>
            </div>
        </header>
    );
}
