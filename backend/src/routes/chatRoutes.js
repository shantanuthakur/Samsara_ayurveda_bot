import { Router } from 'express';
import { chatHandler, healthHandler } from '../controllers/chatController.js';

const router = Router();

router.post('/chat', chatHandler);

router.get('/health', healthHandler);

export default router;