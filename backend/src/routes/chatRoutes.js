import { Router } from 'express';
import { chatHandler, healthHandler } from '../controllers/chatController.js';

const router = Router();

// RAG chat endpoint
router.post('/chat', chatHandler);

// Health check
router.get('/health', healthHandler);

export default router;
