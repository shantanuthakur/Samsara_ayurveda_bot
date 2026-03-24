# 🌿 Ayurveda Chatbot — Frontend

A modern **React + Vite** chat interface for the Ayurveda RAG backend. Users can ask health-related questions and receive personalized Ayurvedic guidance from an AI-powered "Ayurvedic Guru."

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_URL=http://localhost:8000/api/chat
```

> [!NOTE]
> For production or ngrok tunneling, update this URL accordingly:
> ```env
> VITE_API_URL=https://your-ngrok-url.ngrok-free.dev/api/chat
> ```

### 3. Start the Dev Server

```bash
npm run dev
```

The app will be available at **http://localhost:5173**.

### 4. Build for Production

```bash
npm run build
npm run preview   # preview the production build locally
```

---

## 📁 Project Structure

```
frontend/
├── public/
│   ├── monk.png              # Bot avatar image
│   └── vite.svg              # Vite logo
├── src/
│   ├── App.jsx               # Main chat application component
│   ├── App.css               # Application styles
│   ├── main.jsx              # React entry point
│   ├── index.css             # Global styles
│   └── assets/               # Static assets
├── .env                      # Environment variables (not committed)
├── .gitignore                # Git ignore rules
├── index.html                # HTML entry point
├── package.json              # Dependencies & scripts
├── vite.config.js            # Vite configuration
└── eslint.config.js          # ESLint configuration
```

---

## ✨ Features

| Feature                  | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| **Chat Interface**       | Clean, WhatsApp-style chat with bot & user messages      |
| **Patient Profile**      | Slide-in sidebar to enter name, age, dosha, BMI, etc.    |
| **Auto BMI Calculation** | Computes BMI from height & weight in real time           |
| **Dosha Selection**      | Dropdown for Vata, Pitta, Kapha & dual-dosha types       |
| **Responsive Design**    | Works on desktop and mobile screens                      |
| **Environment Config**   | API URL configurable via `.env` (no hardcoded URLs)      |

---

## 🔌 API Integration

The frontend sends a `POST` request to the backend at the URL defined by `VITE_API_URL`.

**Request payload:**

```json
{
  "prompt": "What diet suits Vata dosha?",
  "name": "Shantanu",
  "age": "25",
  "gender": "Male",
  "bmi": "22.5",
  "location": "Delhi, India",
  "dosha": "Vata",
  "bodyType": "Slim",
  "chronicDisease": ""
}
```

**Response:**

```json
{
  "response": "Based on Ayurvedic principles, a Vata-pacifying diet should include..."
}
```

---

## 🎨 Tech Stack

| Technology   | Purpose                     |
| ------------ | --------------------------- |
| React 19     | UI framework                |
| Vite 7       | Build tool & dev server     |
| Axios        | HTTP client for API calls   |
| Lucide React | Icon library                |
| Vanilla CSS  | Styling (custom properties) |

---

## ⚙️ Environment Variables

| Variable       | Required | Description                          | Default                              |
| -------------- | -------- | ------------------------------------ | ------------------------------------ |
| `VITE_API_URL` | Yes      | Full URL to the backend chat endpoint | `http://localhost:8000/api/chat`     |

---

## 📄 License

This project is for educational and research purposes.
