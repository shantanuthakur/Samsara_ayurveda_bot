import 'dotenv/config';
import app from './app.js';
import logger from './utils/logger.js';

const PORT = parseInt(process.env.PORT) || 8000;

app.listen(PORT, () => {
  logger.info(` RAG Chatbot backend running on port ${PORT}`);
  logger.info(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   Qdrant      : ${process.env.QDRANT_URL || 'http://localhost:6333'}`);
  logger.info(`   Collection  : ${process.env.QDRANT_COLLECTION || 'ayurveda_core_data'}`);
  logger.info(`   Chat Model  : ${process.env.CHAT_MODEL || 'gpt-4o-mini'}`);
});


process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: reason?.message || reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
