import React from "react";
import "./WelcomeScreen.css";

const SUGGESTIONS = [
    { icon: "🌿", text: "What herbs help with digestion?" },
    { icon: "🧘", text: "Yoga recommendations for stress" },
    { icon: "🥗", text: "Create a personalized Ayurvedic diet plan for me" },
    { icon: "🍵", text: "Immunity boosting Ayurvedic tips" },
];

export default function WelcomeScreen({ onSuggestionClick }) {
    return (
        <div className="welcome-screen">
            {/* Animated Background Orbs */}
            <div className="welcome-bg" aria-hidden="true">
                <div className="welcome-orb welcome-orb-1"></div>
                <div className="welcome-orb welcome-orb-2"></div>
                <div className="welcome-orb welcome-orb-3"></div>
            </div>

            <div className="welcome-content">
                <img src="/monk.png" className="welcome-avatar" alt="AI Guru" />

                <div className="welcome-text">
                    <h2 className="welcome-heading">
                        Namaste 🙏 <br />
                        I am <span className="accent">AI Guru</span>
                    </h2>
                    <p className="welcome-subtitle">
                        Your personal Ayurvedic AI advisor. Ask me about remedies, diet,
                        dosha balancing, herbs, or any wellness concern.
                    </p>
                </div>

                <div className="suggestion-grid">
                    {SUGGESTIONS.map((s, i) => (
                        <button
                            key={i}
                            className="suggestion-card"
                            onClick={() => onSuggestionClick(s.text)}
                            id={`suggestion-${i}`}
                        >
                            <span className="suggestion-icon">{s.icon}</span>
                            {s.text}
                        </button>
                    ))}
                </div>

                <div className="welcome-om" aria-hidden="true">ॐ</div>
            </div>
        </div>
    );
}
