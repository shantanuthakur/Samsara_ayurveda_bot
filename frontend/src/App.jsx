import React, { useState, useEffect, useRef } from "react";
import ChatHeader from "./components/ChatHeader";
import { ChatMessage, TypingIndicator } from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import ProfileSidebar from "./components/ProfileSidebar";
import WelcomeScreen from "./components/WelcomeScreen";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/chat";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [streamingContent, setStreamingContent] = useState("");

  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("samsara_profile");
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return {
      name: "",
      age: "",
      gender: "",
      height: "",
      weight: "",
      dosha: "",
      bodyType: "",
      location: "",
      chronicDisease: "",
      sleepQuality: "",
      menstrualCycles: "",
    };
  });

  const [bmi, setBmi] = useState("");
  const chatEndRef = useRef(null);

  // Calculate BMI
  useEffect(() => {
    if (profile.height && profile.weight) {
      const h = profile.height / 100;
      setBmi((profile.weight / (h * h)).toFixed(1));
    } else {
      setBmi("");
    }
  }, [profile.height, profile.weight]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const sendMessage = async (text) => {
    const userText = text || input;
    if (!userText.trim() || loading) return;

    // Validate required fields (chronicDisease is optional)
    const requiredFields = ["name", "age", "gender", "height", "weight", "bodyType", "dosha", "location", "sleepQuality"];
    if (profile.gender === "Female") requiredFields.push("menstrualCycles");
    const isMissing = requiredFields.some((field) => !profile[field] || profile[field].toString().trim() === "");

    if (isMissing) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: userText },
        { role: "bot", content: "Please fill all your information in the Patient Profile first." }
      ]);
      setInput("");
      setSidebarOpen(true);
      return;
    }

    // Format history for OpenAI (roles: "user" | "assistant")
    const chatHistory = messages.map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.content,
    }));

    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setInput("");
    setLoading(true);
    setStreamingContent("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userText,
          history: chatHistory,
          ...profile,
          bmi,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamingContent(accumulated);
      }

      // Streaming done — commit the full message and clear streaming state
      setMessages((prev) => [...prev, { role: "bot", content: accumulated }]);
      setStreamingContent("");
    } catch (err) {
      console.error("Chat Error:", err);
      setStreamingContent("");
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: "I'm unable to connect right now. Please check that the backend server is running and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="app-shell">
      {/* Ambient Background */}
      <div className="app-ambient" aria-hidden="true" />

      <div className="chat-container" id="chat-container">
        <ChatHeader onToggleProfile={() => setSidebarOpen(true)} />

        {hasMessages ? (
          <div className="chat-body" id="chat-body">
            <div className="chat-messages">
              {messages.map((m, i) => (
                <ChatMessage key={i} role={m.role} content={m.content} />
              ))}
              {loading && streamingContent === "" && <TypingIndicator />}
              {streamingContent !== "" && (
                <ChatMessage role="bot" content={streamingContent} />
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        ) : (
          <WelcomeScreen
            onSuggestionClick={(text) => {
              setInput(text);
              sendMessage(text);
            }}
          />
        )}

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => sendMessage()}
          disabled={loading}
        />
      </div>

      <ProfileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        profile={profile}
        onProfileChange={setProfile}
        bmi={bmi}
      />
    </div>
  );
}

export default App;