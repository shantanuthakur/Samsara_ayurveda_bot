# Samsara — Ayurveda RAG Chatbot

A full-stack Retrieval-Augmented Generation (RAG) chatbot that provides personalized Ayurvedic health advice. The bot uses vector search to find relevant knowledge from curated databases, then generates natural, doctor-like responses using OpenAI.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│     Frontend    │────▶│      Backend     │────▶│      Qdrant     │
│  React + Vite   │     │  Node.js/Express │     │  Vector Database │
│  Port 5000      │     │  Port 8000       │     │  Port 6333      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │   OpenAI API │
                        │  Embeddings +│
                        │  Chat (GPT)  │
                        └──────────────┘
```

**Frontend** — React/Vite web app with patient profile sidebar (age, dosha, BMI, location).
**Backend** — Express REST server that handles the RAG pipeline: embed -> search -> generate.
**Qdrant** — Vector database storing Ayurvedic knowledge embeddings.
**OpenAI** — Generates text embeddings (`text-embedding-3-small`) and chat responses (`gpt-4o-mini`).

---

## Project Structure

```
rag_chatbot/
├── docker-compose.yml          # Qdrant via Docker (cross-platform)
├── .env.example                # Points to per-directory env files
├── .gitignore
├── README.md
│
├── backend/
│   ├── .env.example            # <- Copy to .env, add your OpenAI key
│   ├── package.json
│   └── src/
│       ├── server.js           # Entry point
│       ├── app.js              # Express app setup
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│   ├── scripts/                # Database management
│   │   ├── seed_qdrant.js      # Seed DB from raw data + OpenAI
│   │   ├── export_snapshots.js # Export DB as snapshot files
│   │   └── restore_snapshots.js# Restore DB from snapshots
│   └── data/                   # Raw data for seeding
│       ├── samsara_remedies_db.json      
│       ├── samsara_nutrition.json        
│       ├── Samsara_india_foods.json      
│       └── vector_export.jsonl
│   ├── .env.example            # <- Copy to .env
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│
├── data/                       # Raw data for seeding
│   ├── samsara_remedies_db.json      
│   ├── samsara_nutrition.json        
│   ├── Samsara_india_foods.json      
│   └── vector_export.jsonl           
```

---

## API Routes

### `POST /api/chat`
Main chat endpoint — handles the full RAG pipeline.

**Request Body:**
```json
{
  "prompt": "I have acidity problems, what should I eat?",
  "history": [],
  "name": "Rahul",
  "age": 28,
  "gender": "Male",
  "height": 175,
  "weight": 70,
  "dosha": "Pitta",
  "location": "Mumbai, Maharashtra"
}
```

**Response:** Streams plain text (the AI's response) via chunked transfer encoding.

### `GET /api/health`
Health check — returns server uptime, Qdrant connection status, and point counts.

### `GET /`
Root endpoint — returns a simple JSON message confirming the API is running and its version.

---

## Testing And Deployment

### Prerequisites
- Node.js v18 or later
- OpenAI API Key

---

### Step 1: Clone and Configure

```bash
git clone <your-repo-url>
cd rag_chatbot

# Set up environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit backend/.env and add your OpenAI API key
nano backend/.env
```

---

### Step 2: Start Qdrant (Vector Database)

Run the included startup script to launch your local Qdrant instance in the background:

```bash
./start_qdrant.sh
```

This starts Qdrant on port 6333. Verify it's running:
```bash
curl http://localhost:6333/collections
```

---

### Step 3: Seed the Database

You have two options for setting up the database. Both merge all data into a single 1536-dimensional collection (`ayurveda_core_data`).

#### Option A: Restore from Snapshots (Fast, Free)
If you have snapshot files in `backend/data/snapshots/`:
```bash
cd backend
npm install
npm run restore-snapshots
```

#### Option B: Seed from Raw Data (Generates Fresh Embeddings)
This generates embeddings via OpenAI and inserts them into Qdrant. Costs ~$0.05-0.10 in API usage.
```bash
cd backend
npm install
npm run seed
```

The seeder will:
1. Load all 4 data files (~40,000+ records)
2. Generate 1536-dimensional embeddings in batches via OpenAI
3. Upsert vectors into the `ayurveda_core_data` collection
4. Verify the uploaded points

---

### Step 4: Start the Backend

```bash
cd backend
npm run dev      # Development (auto-reload)
# OR
npm start        # Production
```

Backend starts on port 8000. Test the health endpoint:
```bash
curl http://localhost:8000/api/health
```

---

### Step 5: Start the Frontend

In a new terminal:
```bash
cd frontend
npm install
npm run dev
```

Frontend starts on port 5000. Open http://localhost:5000.

---

## Production Deployment (VPS / Cloud)

For a production deployment to a VPS (e.g. AWS EC2, DigitalOcean, Linode), you will need to run the following components:

1. **Qdrant (Database)**: Running via Docker.
2. **Node.js Backend**: Running via PM2.
3. **React Frontend**: Built statically and served via Nginx.

### 1. Database Deployment (Qdrant)

The easiest way to run the vector database in production is using Docker Compose. Make sure Docker is installed on your server.

```bash
# Start Qdrant in detached mode
docker compose up -d

# Verify Qdrant is running on port 6333
curl http://localhost:6333/collections
```

*Note: Once Qdrant is running, you must either seed the database or restore from snapshots just like in the local setup (see Step 3 above).*

### 2. Backend Deployment (PM2)

Use PM2 to keep the backend running continuously and automatically restart it if it crashes.

```bash
# Install PM2 globally
npm install -g pm2

# Install backend dependencies
cd backend
npm install

# Setup your production variables (.env)
cp .env.example .env
nano .env  # Add your OPENAI_API_KEY and set NODE_ENV=production

# Start backend via PM2
pm2 start src/server.js --name "samsara-backend"
pm2 save       # Save PM2 process list
pm2 startup    # Configure PM2 to start on server boot
```

### 3. Frontend Deployment (Nginx)

The frontend should be built into static HTML/CSS/JS and served via a web server like Nginx.

```bash
# Build the frontend application
cd frontend
npm install
npm run build
```

This creates a `dist/` directory. You will configure Nginx to serve these files and proxy API requests to your backend (port `8000`).

**Example Nginx Configuration (`/etc/nginx/sites-available/samsara`)**:
```nginx
server {
    listen 80;
    server_name your-domain.com; # Or your server IP

    # Serve React Frontend
    location / {
        root /path/to/rag_chatbot/frontend/dist; # IMPORTANT: Update this path!
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to node Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable the site and restart Nginx
sudo ln -s /etc/nginx/sites-available/samsara /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Environment Variables

### Backend (`backend/.env`)

- `OPENAI_API_KEY`: Required. OpenAI API key.
- `PORT`: Backend server port (default: 8000).
- `QDRANT_URL`: Qdrant connection URL (default: http://localhost:6333).
- `QDRANT_API_KEY`: Optional Qdrant Cloud API key.
- `QDRANT_COLLECTION`: Collection name (default: ayurveda_core_data).
- `CHAT_MODEL`: OpenAI chat model (default: gpt-4o-mini).
- `EMBEDDING_MODEL`: OpenAI embedding model (default: text-embedding-3-small).
- `TOP_K`: Number of vector search results (default: 5).
- `SIMILARITY_THRESHOLD`: Minimum relevance score (default: 0.35).

### Frontend (`frontend/.env`)

- `VITE_API_URL`: Backend chat API URL (default: http://localhost:8000/api/chat).

---

## Data Sources

- samsara_remedies_db.json: 1,158 condition-to-remedy mappings with dosha associations
- samsara_nutrition.json: 1,480 food items with nutrition and dosha effects
- Samsara_india_foods.json: 29,488 regional Indian foods with nutrition and dosha data
- vector_export.jsonl: 8,700 text chunks from Ayurvedic reference materials
