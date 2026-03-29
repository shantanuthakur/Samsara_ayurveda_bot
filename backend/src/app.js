import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import chatRoutes from './routes/chatRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './utils/logger.js';

const app = express();


app.use(helmet());

app.use(cors({
  origin: [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a moment.' },
});
app.use('/api/', limiter);

const morganStream = { write: (msg) => logger.http(msg.trim()) };
app.use(morgan('short', { stream: morganStream }));

app.use('/api', chatRoutes);


app.get('/', (req, res) => {
  res.json({ message: 'RAG Chatbot API is running', version: '1.0.0' });
});


app.use(errorHandler);

export default app;
