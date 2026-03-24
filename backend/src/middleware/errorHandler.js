import logger from '../utils/logger.js';


const errorHandler = (err, req, res, _next) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An internal error occurred. Please try again later.'
    : err.message;

  res.status(statusCode).json({ error: message });
};

export default errorHandler;
