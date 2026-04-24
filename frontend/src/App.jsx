import React, { useState, useEffect, useRef } from "react";
import ChatHeader from "./components/ChatHeader";
import { ChatMessage, TypingIndicator } from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import ProfileSidebar from "./components/ProfileSidebar";
import WelcomeScreen from "./components/WelcomeScreen";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/chat";

// Detect if the user is asking for a diet/meal plan or food recommendation
const DIET_KEYWORDS = [
  "diet plan", "meal plan", "food chart", "food plan", "calorie plan",
  "weight loss diet", "weight gain diet", "what should i eat",
  "daily diet", "eating plan", "nutrition plan", "diet chart",
  "breakfast lunch dinner", "khana", "aahaar", "bhojan",
  "suggest food", "suggest diet", "recommend diet", "recommend food",
  "meal chart", "food schedule", "diet schedule", "kya khana chahiye",
  "diet food", "food recommendation", "diet item", "diet recommendation",
  "what to eat", "what can i eat", "what i eat", "food suggestion",
  "food for me", "best food", "healthy food", "healthy diet",
  "weight loss food", "weight gain food", "food advice", "eating advice",
  "my diet", "my food", "my meal", "give me diet", "give me food",
  "give me meal", "create diet", "create meal", "make diet", "make meal",
  "plan my diet", "plan my meal", "diet for me", "meal for me",
  "food for weight", "food for health", "diet tips", "food tips",
  "kya khaye", "kya khau", "khana batao", "diet batao",
  "gym diet", "gym food", "gym meal", "workout diet", "workout food",
  "fitness diet", "fitness food", "muscle diet", "protein diet",
  "bodybuilding diet", "exercise diet", "training diet",
];

function isDietPlanQuery(text) {
  const lower = text.toLowerCase();
  return DIET_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
}

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

    // Only validate profile for diet/meal plan queries
    if (isDietPlanQuery(userText)) {
      const requiredFields = ["name", "age", "gender", "height", "weight", "bodyType", "dosha", "location", "sleepQuality"];
      if (profile.gender === "Female") requiredFields.push("menstrualCycles");
      const isMissing = requiredFields.some((field) => !profile[field] || profile[field].toString().trim() === "");

      if (isMissing) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: userText },
          { role: "bot", content: "📋 **Profile Incomplete**\n\nTo create a personalized diet plan, I need your complete profile information.\n\n**Please fill in your details:**\n- 👤 **Name**, **Age**, **Gender**\n- 📏 **Height** & **Weight**\n- 🧬 **Body Type** & **Dosha**\n- 📍 **Location**\n- 😴 **Sleep Quality**\n\nOpen the **Patient Profile** sidebar ➡️ to fill in your details, then ask me again! 🙏" }
        ]);
        setInput("");
        setSidebarOpen(true);
        return;
      }
    }

    // Format history for OpenAI (roles: "user" | "assistant")
    // Limit to last 6 messages (3 exchanges) to prevent context overflow
    // which causes the model to ignore system prompt rules in long conversations
    const allHistory = messages.map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.content,
    }));
    const chatHistory = allHistory.slice(-6);

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
          content: "⚠️ **Connection Error**\n\nI'm unable to connect to the server right now.\n\n**Please check:**\n- 🖥️ The backend server is running (`npm run dev`)\n- 🌐 Your internet connection is active\n- 🔄 Try refreshing the page\n\nIf the issue persists, please restart the backend server and try again. 🙏",
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