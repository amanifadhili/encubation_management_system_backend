import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { SecurityAudit } from '../config/security';

// Extend Error interface to include status code
interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

// Helper functions for error handling
const isSecurityError = (error: CustomError): boolean => {
  const securityErrorCodes = [
    'INVALID_TOKEN',
    'EXPIRED_TOKEN',
    'INSUFFICIENT_PERMISSIONS',
    'RATE_LIMIT_EXCEEDED',
    'AUTHENTICATION_FAILED'
  ];

  return securityErrorCodes.includes(error.code || '') ||
         error.message?.toLowerCase().includes('unauthorized') ||
         error.message?.toLowerCase().includes('forbidden') ||
         error.message?.toLowerCase().includes('authentication');
};

const getSecurityEventType = (error: CustomError): any => {
  const code = error.code || '';

  switch (code) {
    case 'INVALID_TOKEN':
    case 'EXPIRED_TOKEN':
      return 'INVALID_TOKEN';
    case 'INSUFFICIENT_PERMISSIONS':
      return 'UNAUTHORIZED_ACCESS';
    case 'RATE_LIMIT_EXCEEDED':
      return 'RATE_LIMIT_EXCEEDED';
    case 'AUTHENTICATION_FAILED':
      return 'AUTH_FAILURE';
    default:
      return 'SUSPICIOUS_ACTIVITY';
  }
};

const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
  code: string;
} => {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      return {
        statusCode: 409,
        message: 'A record with this information already exists',
        code: 'DUPLICATE_ENTRY'
      };

    case 'P2025':
      // Record not found
      return {
        statusCode: 404,
        message: 'Record not found',
        code: 'NOT_FOUND'
      };

    case 'P2003':
      // Foreign key constraint violation
      return {
        statusCode: 400,
        message: 'Cannot perform this action due to related records',
        code: 'FOREIGN_KEY_VIOLATION'
      };

    case 'P2028':
      // Transaction API error
      return {
        statusCode: 400,
        message: 'Transaction failed',
        code: 'TRANSACTION_ERROR'
      };

    default:
      return {
        statusCode: 500,
        message: 'Database operation failed',
        code: 'DATABASE_ERROR'
      };
  }
};

const handleMulterError = (error: any): {
  statusCode: number;
  message: string;
  code: string;
} => {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return {
        statusCode: 413,
        message: 'File size exceeds the maximum allowed limit',
        code: 'FILE_TOO_LARGE'
      };

    case 'LIMIT_FILE_COUNT':
      return {
        statusCode: 400,
        message: 'Too many files uploaded',
        code: 'TOO_MANY_FILES'
      };

    case 'LIMIT_FIELD_KEY':
      return {
        statusCode: 400,
        message: 'File field name too long',
        code: 'FIELD_NAME_TOO_LONG'
      };

    case 'LIMIT_FIELD_VALUE':
      return {
        statusCode: 400,
        message: 'File field value too long',
        code: 'FIELD_VALUE_TOO_LONG'
      };

    case 'LIMIT_FIELD_COUNT':
      return {
        statusCode: 400,
        message: 'Too many file fields',
        code: 'TOO_MANY_FIELDS'
      };

    case 'LIMIT_UNEXPECTED_FILE':
      return {
        statusCode: 400,
        message: 'Unexpected file field',
        code: 'UNEXPECTED_FILE'
      };

    default:
      return {
        statusCode: 400,
        message: 'File upload error',
        code: 'UPLOAD_ERROR'
      };
  }
};

// Global error handler middleware
export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let code = error.code || 'INTERNAL_ERROR';
  let details: any = error.details;

  // Log security-related errors
  if (isSecurityError(error)) {
    SecurityAudit.log({
      type: getSecurityEventType(error),
      message: `Security error: ${error.message}`,
      userId: (req as any).user?.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      details: {
        method: req.method,
        error: error.message,
        stack: error.stack
      }
    });
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(error);
    statusCode = prismaError.statusCode;
    message = prismaError.message;
    code = prismaError.code;
  }

  // Handle Prisma validation errors
  else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
    code = 'VALIDATION_ERROR';
  }

  // Handle Prisma connection errors
  else if (error instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 503;
    message = 'Database connection error';
    code = 'DATABASE_ERROR';
  }

  // Handle JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    code = 'INVALID_TOKEN';
  }

  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    code = 'EXPIRED_TOKEN';
  }

  // Handle multer file upload errors
  else if (error.name === 'MulterError') {
    const multerError = handleMulterError(error);
    statusCode = multerError.statusCode;
    message = multerError.message;
    code = multerError.code;
  }

  // Handle rate limiting errors
  else if (error.message?.includes('Too many')) {
    statusCode = 429;
    code = 'RATE_LIMIT_EXCEEDED';
  }

  // Handle validation errors (from Joi)
  else if (error.details) {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = error.details;
  }

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      message: error.message,
      stack: error.stack,
      statusCode,
      code,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId
    });
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      originalError: error.message
    })
  });
};

// Check if error is security-related
errorHandler.isSecurityError = (error: CustomError): boolean => {
  const securityErrorCodes = [
    'INVALID_TOKEN',
    'EXPIRED_TOKEN',
    'INSUFFICIENT_PERMISSIONS',
    'RATE_LIMIT_EXCEEDED',
    'AUTHENTICATION_FAILED'
  ];

  return securityErrorCodes.includes(error.code || '') ||
         error.message?.toLowerCase().includes('unauthorized') ||
         error.message?.toLowerCase().includes('forbidden') ||
         error.message?.toLowerCase().includes('authentication');
};

// Get security event type from error
errorHandler.getSecurityEventType = (error: CustomError): any => {
  const code = error.code || '';

  switch (code) {
    case 'INVALID_TOKEN':
    case 'EXPIRED_TOKEN':
      return 'INVALID_TOKEN';
    case 'INSUFFICIENT_PERMISSIONS':
      return 'UNAUTHORIZED_ACCESS';
    case 'RATE_LIMIT_EXCEEDED':
      return 'RATE_LIMIT_EXCEEDED';
    case 'AUTHENTICATION_FAILED':
      return 'AUTH_FAILURE';
    default:
      return 'SUSPICIOUS_ACTIVITY';
  }
};

// Handle Prisma known request errors
errorHandler.handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
  code: string;
} => {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      return {
        statusCode: 409,
        message: 'A record with this information already exists',
        code: 'DUPLICATE_ENTRY'
      };

    case 'P2025':
      // Record not found
      return {
        statusCode: 404,
        message: 'Record not found',
        code: 'NOT_FOUND'
      };

    case 'P2003':
      // Foreign key constraint violation
      return {
        statusCode: 400,
        message: 'Cannot perform this action due to related records',
        code: 'FOREIGN_KEY_VIOLATION'
      };

    case 'P2028':
      // Transaction API error
      return {
        statusCode: 400,
        message: 'Transaction failed',
        code: 'TRANSACTION_ERROR'
      };

    default:
      return {
        statusCode: 500,
        message: 'Database operation failed',
        code: 'DATABASE_ERROR'
      };
  }
};

// Handle multer file upload errors
errorHandler.handleMulterError = (error: any): {
  statusCode: number;
  message: string;
  code: string;
} => {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return {
        statusCode: 413,
        message: 'File size exceeds the maximum allowed limit',
        code: 'FILE_TOO_LARGE'
      };

    case 'LIMIT_FILE_COUNT':
      return {
        statusCode: 400,
        message: 'Too many files uploaded',
        code: 'TOO_MANY_FILES'
      };

    case 'LIMIT_FIELD_KEY':
      return {
        statusCode: 400,
        message: 'File field name too long',
        code: 'FIELD_NAME_TOO_LONG'
      };

    case 'LIMIT_FIELD_VALUE':
      return {
        statusCode: 400,
        message: 'File field value too long',
        code: 'FIELD_VALUE_TOO_LONG'
      };

    case 'LIMIT_FIELD_COUNT':
      return {
        statusCode: 400,
        message: 'Too many file fields',
        code: 'TOO_MANY_FIELDS'
      };

    case 'LIMIT_UNEXPECTED_FILE':
      return {
        statusCode: 400,
        message: 'Unexpected file field',
        code: 'UNEXPECTED_FILE'
      };

    default:
      return {
        statusCode: 400,
        message: 'File upload error',
        code: 'UPLOAD_ERROR'
      };
  }
};

// 404 Not Found handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    code: 'NOT_FOUND'
  });
};

// Request logging middleware (for development)
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip;
    const userId = (req as any).user?.userId || 'anonymous';

    // Color coding for different status codes
    let statusColor = '\x1b[32m'; // Green for success
    if (status >= 400 && status < 500) statusColor = '\x1b[33m'; // Yellow for client errors
    if (status >= 500) statusColor = '\x1b[31m'; // Red for server errors

    console.log(
      `${method} ${url} ${statusColor}${status}\x1b[0m ${duration}ms - ${ip} - ${userId}`
    );
  });

  next();
};

// Health check endpoint
export const healthCheck = (req: Request, res: Response): void => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
};

// Security headers middleware (additional to Helmet)
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Additional security headers not covered by Helmet
  res.setHeader('X-Request-ID', `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  res.setHeader('X-Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-WebKit-CSP', "default-src 'self'");

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Feature policy (permissions)
  res.setHeader('Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), magnetometer=(), gyroscope=(), speaker=(), fullscreen=()'
  );

  // DNS prefetch control
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  next();
};