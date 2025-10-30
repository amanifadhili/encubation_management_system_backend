import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Validation result interface
interface ValidationResult {
  success: boolean;
  message: string;
  errors?: ValidationError[];
  code: string;
}

interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Validation middleware for request body
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const result: ValidationResult = {
        success: false,
        message: 'Validation failed',
        errors,
        code: 'VALIDATION_ERROR'
      };

      res.status(400).json(result);
      return;
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Validation middleware for query parameters
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const result: ValidationResult = {
        success: false,
        message: 'Query validation failed',
        errors,
        code: 'QUERY_VALIDATION_ERROR'
      };

      res.status(400).json(result);
      return;
    }

    // Note: req.query is read-only in Express.js, so we validate but don't replace it
    next();
  };
};

// Validation middleware for route parameters
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const result: ValidationResult = {
        success: false,
        message: 'Parameter validation failed',
        errors,
        code: 'PARAM_VALIDATION_ERROR'
      };

      res.status(400).json(result);
      return;
    }

    // Note: req.params is read-only in Express.js, so we validate but don't replace it
    next();
  };
};

// Combined validation middleware for multiple parts of the request
export const validateRequest = (options: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors: ValidationError[] = [];

    // Validate body
    if (options.body) {
      const { error: bodyError, value: bodyValue } = options.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (bodyError) {
        errors.push(...bodyError.details.map(detail => ({
          field: `body.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      } else {
        req.body = bodyValue;
      }
    }

    // Validate query
    if (options.query) {
      const { error: queryError } = options.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (queryError) {
        errors.push(...queryError.details.map(detail => ({
          field: `query.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      }
      // Note: req.query is read-only in Express.js, so we validate but don't replace it
    }

    // Validate params
    if (options.params) {
      const { error: paramsError } = options.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (paramsError) {
        errors.push(...paramsError.details.map(detail => ({
          field: `params.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context?.value
        })));
      }
      // Note: req.params is read-only in Express.js, so we validate but don't replace it
    }

    // If there are any errors, return them
    if (errors.length > 0) {
      const result: ValidationResult = {
        success: false,
        message: 'Validation failed',
        errors,
        code: 'VALIDATION_ERROR'
      };

      res.status(400).json(result);
      return;
    }

    next();
  };
};

// Sanitization middleware to clean user inputs
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Recursively sanitize strings in the request body
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters and trim whitespace
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    } else if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    } else if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          sanitized[key] = sanitizeValue(value[key]);
        }
      }
      return sanitized;
    }
    return value;
  };

  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }

  // Note: req.query is read-only in Express.js, so we skip sanitization for query params
  // The validation middleware above will catch any malicious query parameters

  next();
};

// Rate limiting helper (basic implementation)
export const createRateLimit = (windowMs: number, maxRequests: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [ip, data] of requests.entries()) {
      if (data.resetTime < windowStart) {
        requests.delete(ip);
      }
    }

    // Get or create request data for this IP
    let requestData = requests.get(key);
    if (!requestData || requestData.resetTime < windowStart) {
      requestData = { count: 0, resetTime: now + windowMs };
      requests.set(key, requestData);
    }

    // Check if limit exceeded
    if (requestData.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((requestData.resetTime - now) / 1000);
      res.status(429)
        .header('Retry-After', String(retryAfterSeconds))
        .json({
          success: false,
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: retryAfterSeconds
        });
      return;
    }

    // Increment counter
    requestData.count++;

    // Add headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - requestData.count).toString(),
      'X-RateLimit-Reset': new Date(requestData.resetTime).toISOString()
    });

    next();
  };
};

// File upload validation middleware
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
} = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    maxFiles = 10
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No files uploaded',
        code: 'NO_FILES'
      });
      return;
    }

    // Check file count
    if (files.length > maxFiles) {
      res.status(400).json({
        success: false,
        message: `Too many files. Maximum ${maxFiles} files allowed.`,
        code: 'TOO_MANY_FILES'
      });
      return;
    }

    const errors: string[] = [];

    // Validate each file
    for (const file of files) {
      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        errors.push(`${file.originalname}: File type ${file.mimetype} is not allowed`);
      }

      // Check file size
      if (file.size > maxSize) {
        errors.push(`${file.originalname}: File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'File validation failed',
        errors,
        code: 'FILE_VALIDATION_ERROR'
      });
      return;
    }

    next();
  };
};