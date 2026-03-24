# Ayurveda Chatbot: Full RAG Application

This repository contains the complete Retrieval-Augmented Generation (RAG) stack for the Ayurveda Chatbot. It provides personalized, context-aware answers solely based on the retrieved knowledge base.

## Architecture 

The application is split into three main components:

- **Frontend (`/frontend`)**: A React/Vite web application that collects the user prompt and their health profile (age, dosha, BMI, etc.) and forwards it to the backend.
- **Backend (`/backend`)**: A Node.js/Express REST server that receives the chat request, converts the text into vector embeddings using OpenAI, searches the Qdrant database for relevant knowledge, and uses an OpenAI ChatCompletion model to synthesize a personalized answer.
- **Vector Database (`/qdrant_local_db`)**: The Qdrant vector database storage directory. It contains `ayurveda_core_data` (32,126 items) which are searched for context.

---

## 🛣️ API Routes

The Node.js backend exposes the following REST API endpoints:

### `POST /api/chat`
The main chat endpoint. It handles the entire RAG pipeline: embedding, vector search, and LLM text generation. 
- **Request Body**: JSON object containing `prompt` (string) and optional user profile fields like `name`, `age`, `gender`, `height`, `weight`, `bmi`, `dosha`, `bodyType`, `location`, `chronicDisease`.
- **Response**: Streams chunks of plain text (the AI's reply) sequentially using the text/plain stream.

### `GET /api/health`
Health check endpoint used to monitor the status of the backend and its connection to Qdrant.
- **Response**: `200 OK` (JSON) containing server uptime, status, and database connection state.

---

## 🚀 Local Development

You need to run **three independent processes** in three separate terminal windows:

### 1. Start the Qdrant Vector Database
Terminal 1:
```bash
cd /Users/shantanuchauhan/Desktop/rag_chatbot
./start_qdrant.sh
```

### 2. Start the Backend Server (Port 8000)
Terminal 2:
```bash
cd /Users/shantanuchauhan/Desktop/rag_chatbot/backend
npm install
npm run dev
```

### 3. Start the Frontend App (Port 5000)
Terminal 3:
```bash
cd /Users/shantanuchauhan/Desktop/rag_chatbot/frontend
npm install
npm run dev
```

---

## 🌍 Production Server Deployment Guide

To deploy this application to a live production server (e.g., Ubuntu VPS on AWS, DigitalOcean, or Hostinger):

### Prerequisites
- Node.js (v18+) and npm installed on the server.
- PM2 installed globally: `npm install -g pm2`
- Nginx installed for reverse proxying and serving the frontend.
- Your Qdrant vector database properly uploaded to the server or hosted on Qdrant Cloud.

### Step 1: Deploy Qdrant
If hosting on the same server, you can wrap the Qdrant binary in a systemd service or use Docker mapping your local volume:
```bash
docker run -d -p 6333:6333 -p 6334:6334 \
    --name qdrant_db \
    -v $(pwd)/qdrant_local_db:/qdrant/storage \
    qdrant/qdrant
```

### Step 2: Setup the Backend
1. Clone your project to the server.
2. Navigate to the backend directory: `cd backend`
3. Install dependencies: `npm install`
4. Configure your `.env` file with production variables:
   ```env
   PORT=8000
   OPENAI_API_KEY=your_key_here
   CORS_ORIGIN=https://yourdomain.com
   QDRANT_URL=http://localhost:6333
   ```
5. Start the backend with PM2 to keep it running in the background:
   ```bash
   pm2 start src/server.js --name "rag-backend"
   pm2 save
   ```

### Step 3: Build the Frontend
1. Navigate to the frontend directory: `cd frontend`
2. Update the `VITE_API_URL` inside your `.env` to point to the live domain API:
   ```env
   VITE_API_URL=https://api.yourdomain.com/api/chat
   ```
3. Install dependencies: `npm install`
4. Build the static production bundle:
   ```bash
   npm run build
   ```
   *This generates a `dist/` folder containing the optimized frontend HTML/CSS/JS.*

### Step 4: Configure Nginx
Configure Nginx to serve your static frontend files and reverse proxy API requests to your Node.js backend. Create a configuration in `/etc/nginx/sites-available/yourdomain.com`:

```nginx
server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;

    # Serve the optimized React Frontend
    location / {
        root /path/to/rag_chatbot/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Reverse Proxy for the Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # CRITICAL: Disable buffering for streaming responses seamlessly!
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```
Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

---

## 🛠️ Troubleshooting

- **EADDRINUSE ::8000**: A backend server is already running in the background. Stop it using `kill -9 $(lsof -t -i:8000)`.
- **Backend fetch failed or Qdrant search failed**: Verify `./start_qdrant.sh` is running and the database is accessible on port `6333`.
- **"Insufficient information..." response**: The prompt was deemed unrelated to Ayurveda or missed the similarity threshold. Adjust `SIMILARITY_THRESHOLD` inside `/backend/.env`.
