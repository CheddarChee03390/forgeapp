// Centralized Error Handling Middleware
// Catches and standardizes error responses across the application

export const errorHandler = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // Log error with details
  console.error(`[${timestamp}] ERROR ${status}: ${message}`);
  console.error(`Path: ${req.method} ${req.path}`);
  if (err.stack) {
    console.error('Stack:', err.stack);
  }
  
  // Determine response message based on status
  let responseMessage = message;
  if (status === 400) {
    responseMessage = message || 'Bad Request';
  } else if (status === 401) {
    responseMessage = 'Unauthorized';
  } else if (status === 404) {
    responseMessage = 'Not Found';
  } else if (status === 409) {
    responseMessage = message || 'Conflict';
  } else if (status >= 500) {
    responseMessage = 'Internal Server Error';
  }
  
  // Send standardized error response
  res.status(status).json({
    success: false,
    error: responseMessage,
    timestamp,
    path: req.path,
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
};

// Wrapper for async route handlers to catch errors
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error class for API errors
export class ApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// Validation error helper
export class ValidationError extends ApiError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

// Not found error helper
export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}
