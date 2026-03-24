import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'rag-chatbot' },
  transports: [
    new winston.transports.File({ filename: 'backend.log', maxsize: 5242880, maxFiles: 5 }),
  ],
});

// Console output in dev
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
} else {
  logger.add(new winston.transports.Console({
    format: winston.format.json(),
  }));
}

export default logger;
