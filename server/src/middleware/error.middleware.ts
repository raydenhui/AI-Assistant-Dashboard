import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/index.js';

// Custom error classes
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', code?: string) {
    super(message, 400, true, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code?: string) {
    super(message, 401, true, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code?: string) {
    super(message, 403, true, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found', code?: string) {
    super(message, 404, true, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', code?: string) {
    super(message, 409, true, code);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error', code?: string) {
    super(message, 500, false, code);
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
    stack?: string;
  };
}

// Format Zod validation errors
function formatZodError(error: ZodError): string {
  return error.errors
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join(', ');
}

// Error handler middleware
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Default error response
  const response: ErrorResponse = {
    success: false,
    error: {
      message: 'An unexpected error occurred',
    },
  };

  let statusCode = 500;

  // Handle known error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    response.error.message = err.message;
    response.error.code = err.code;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    response.error.message = 'Validation error';
    response.error.code = 'VALIDATION_ERROR';
    response.error.details = formatZodError(err);
  } else if (err instanceof SyntaxError && 'body' in err) {
    // JSON parsing error
    statusCode = 400;
    response.error.message = 'Invalid JSON in request body';
    response.error.code = 'INVALID_JSON';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    response.error.message = 'Invalid token';
    response.error.code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    response.error.message = 'Token expired';
    response.error.code = 'TOKEN_EXPIRED';
  } else {
    // Unknown error
    response.error.message = config.isDevelopment
      ? err.message
      : 'An unexpected error occurred';
  }

  // Include stack trace in development
  if (config.isDevelopment && err.stack) {
    response.error.stack = err.stack;
  }

  // Log error
  if (statusCode >= 500) {
    console.error('❌ Server Error:', {
      message: err.message,
      stack: err.stack,
      statusCode,
    });
  } else if (config.isDevelopment) {
    console.warn('⚠️ Client Error:', {
      message: err.message,
      statusCode,
    });
  }

  res.status(statusCode).json(response);
};

// 404 handler for unmatched routes
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(
    `Route not found: ${req.method} ${req.originalUrl}`,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// Async handler wrapper to catch errors in async route handlers
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
