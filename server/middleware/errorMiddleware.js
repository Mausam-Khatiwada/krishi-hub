const AppError = require('../utils/AppError');

const handleCastErrorDB = (err) => new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0];
  return new AppError(`Duplicate value for field: ${field}`, 400);
};

const handleValidationErrorDB = (err) => {
  const messages = Object.values(err.errors || {})
    .map((item) => item.message)
    .filter(Boolean);

  return new AppError(messages.join('. ') || 'Validation failed', 400);
};

const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);

const handleMulterError = (err) => new AppError(err.message || 'File upload failed', 400);

const globalErrorHandler = (err, _req, res, _next) => {
  let error = err;

  if (!(error instanceof AppError)) {
    error = new AppError(err.message || 'Internal server error', err.statusCode || 500);
  }

  if (err.name === 'CastError') {
    error = handleCastErrorDB(err);
  }

  if (err.code === 11000) {
    error = handleDuplicateFieldsDB(err);
  }

  if (err.name === 'ValidationError') {
    error = handleValidationErrorDB(err);
  }

  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  if (err.name === 'MulterError') {
    error = handleMulterError(err);
  }

  res.status(error.statusCode || 500).json({
    status: error.status || 'error',
    message: error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = globalErrorHandler;
