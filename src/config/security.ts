import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Application } from 'express';

// Security configuration interface
interface SecurityConfig {
  cors: {
    origin: string | string[] | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge: number;
  };
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: string[];
        scriptSrc: string[];
        styleSrc: string[];
        imgSrc: string[];
        connectSrc: string[];
        fontSrc: string[];
        objectSrc: string[];
        mediaSrc: string[];
        frameSrc: string[];
      };
    };
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    noSniff: boolean;
    xssFilter: boolean;
    referrerPolicy: string;
  };
  rateLimit: {
    windowMs: number;
    max: number;
    message: string;
    standardHeaders: boolean;
    legacyHeaders: boolean;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  authRateLimit: {
    windowMs: number;
    max: number;
    message: string;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  };
  fileUploadRateLimit: {
    windowMs: number;
    max: number;
    message: string;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  };
}

// Function to get CORS origin from environment variable
function getCorsOrigin(): string[] {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin) {
    throw new Error('CORS_ORIGIN environment variable is required. Please set it in your .env file.');
  }
  return corsOrigin.split(',').map(origin => origin.trim());
}

// Default security configuration - CORS origin is loaded dynamically
function getDefaultConfig(): SecurityConfig {
  return {
    cors: {
      origin: getCorsOrigin(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-Access-Token'
      ],
      exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      maxAge: 86400 // 24 hours
    },

  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.", "wss:", "ws:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: 'strict-origin-when-cross-origin'
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: JSON.stringify({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    }),
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  authRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 20 : 5, // More lenient in development
    message: JSON.stringify({
      success: false,
      message: 'Too many login attempts, please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    }),
    standardHeaders: true,
    legacyHeaders: false
  },

  fileUploadRateLimit: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Limit each IP to 20 file uploads per hour
    message: JSON.stringify({
      success: false,
      message: 'Too many file uploads, please try again later.',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      retryAfter: '1 hour'
    }),
    standardHeaders: true,
    legacyHeaders: false
  }
  };
}

// Create security middleware
export class SecurityMiddleware {
  private static config: SecurityConfig = getDefaultConfig();

  /**
   * Configure security settings
   */
  static configure(config?: Partial<SecurityConfig>): void {
    this.config = { ...getDefaultConfig(), ...config };
  }

  /**
   * Apply all security middleware to Express app
   */
  static applySecurity(app: Application): void {
    // Trust proxy for rate limiting behind reverse proxy
    app.set('trust proxy', 1);

    // Apply Helmet security headers
    this.applyHelmet(app);

    // Apply CORS
    this.applyCors(app);

    // Apply rate limiting
    this.applyRateLimiting(app);
  }

  /**
   * Apply Helmet security headers
   */
  private static applyHelmet(app: Application): void {
    app.use(helmet({
      contentSecurityPolicy: this.config.helmet.contentSecurityPolicy,
      hsts: this.config.helmet.hsts,
      noSniff: this.config.helmet.noSniff,
      xssFilter: this.config.helmet.xssFilter
    }));

    // Set referrer policy separately
    app.use(helmet.referrerPolicy({ policy: this.config.helmet.referrerPolicy as any }));

    // Additional security headers
    app.use((req, res, next) => {
      // Remove X-Powered-By header
      res.removeHeader('X-Powered-By');

      // Add additional security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

      // Only in production
      if (process.env.NODE_ENV === 'production') {
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      }

      next();
    });
  }

  /**
   * Apply CORS configuration
   */
  private static applyCors(app: Application): void {
    // Reload CORS origin from environment to ensure it's current
    const corsOrigin = getCorsOrigin();
    const corsConfig = {
      ...this.config.cors,
      origin: corsOrigin,
      // Explicitly handle preflight requests
      preflightContinue: false,
      // Ensure Authorization header is allowed
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-Access-Token'
      ]
    };
    
    app.use(cors(corsConfig));
  }

  /**
   * Apply rate limiting
   */
  private static applyRateLimiting(app: Application): void {
    // Skip rate limiting in development mode for easier testing
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    // General API rate limiting
    app.use('/api/', rateLimit(this.config.rateLimit));

    // Auth endpoints - stricter limiting
    app.use('/api/auth/', rateLimit(this.config.authRateLimit));

    // File upload endpoints - upload-specific limiting
    app.use('/api/upload/', rateLimit(this.config.fileUploadRateLimit));
  }

  /**
   * Get general rate limiter for custom use
   */
  static getGeneralRateLimit() {
    return rateLimit(this.config.rateLimit);
  }

  /**
   * Get auth rate limiter for custom use
   */
  static getAuthRateLimit() {
    return rateLimit(this.config.authRateLimit);
  }

  /**
   * Get file upload rate limiter for custom use
   */
  static getFileUploadRateLimit() {
    return rateLimit(this.config.fileUploadRateLimit);
  }

  /**
   * Create custom rate limiter
   */
  static createCustomRateLimit(options: Partial<ReturnType<typeof getDefaultConfig>['rateLimit']>) {
    return rateLimit({ ...this.config.rateLimit, ...options });
  }
}

// Password policy configuration
export class PasswordPolicy {
  private static config = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
    preventSequentialChars: true,
    preventRepeatedChars: true
  };

  /**
   * Configure password policy
   */
  static configure(config: Partial<typeof PasswordPolicy.config>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Validate password against policy
   */
  static validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.config.minLength) {
      errors.push(`Password must be at least ${this.config.minLength} characters long`);
    }

    if (password.length > this.config.maxLength) {
      errors.push(`Password cannot exceed ${this.config.maxLength} characters`);
    }

    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.config.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (this.config.preventCommonPasswords) {
      const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome'];
      if (commonPasswords.includes(password.toLowerCase())) {
        errors.push('Password is too common, please choose a stronger password');
      }
    }

    if (this.config.preventSequentialChars) {
      // Check for sequential characters (e.g., abc, 123)
      const sequentialPatterns = [
        /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i,
        /012|123|234|345|456|567|678|789|890/i
      ];

      for (const pattern of sequentialPatterns) {
        if (pattern.test(password)) {
          errors.push('Password cannot contain sequential characters');
          break;
        }
      }
    }

    if (this.config.preventRepeatedChars) {
      // Check for repeated characters (e.g., aaa, 111)
      if (/(.)\1{2,}/.test(password)) {
        errors.push('Password cannot contain repeated characters');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get password requirements for display
   */
  static getRequirements(): string[] {
    const requirements: string[] = [];

    requirements.push(`At least ${this.config.minLength} characters long`);
    if (this.config.maxLength < 1000) {
      requirements.push(`No more than ${this.config.maxLength} characters`);
    }

    if (this.config.requireUppercase) {
      requirements.push('At least one uppercase letter (A-Z)');
    }

    if (this.config.requireLowercase) {
      requirements.push('At least one lowercase letter (a-z)');
    }

    if (this.config.requireNumbers) {
      requirements.push('At least one number (0-9)');
    }

    if (this.config.requireSpecialChars) {
      requirements.push('At least one special character (!@#$%^&*...)');
    }

    if (this.config.preventCommonPasswords) {
      requirements.push('Cannot be a common password');
    }

    if (this.config.preventSequentialChars) {
      requirements.push('Cannot contain sequential characters (abc, 123)');
    }

    if (this.config.preventRepeatedChars) {
      requirements.push('Cannot contain repeated characters (aaa, 111)');
    }

    return requirements;
  }
}

// Security audit logging
export class SecurityAudit {
  private static logs: SecurityEvent[] = [];

  static log(event: Omit<SecurityEvent, 'timestamp' | 'id'>): void {
    const securityEvent: SecurityEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      ...event
    };

    this.logs.push(securityEvent);

    // In production, you would send this to a logging service

    // Keep only last 1000 logs in memory
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  static getLogs(limit: number = 100): SecurityEvent[] {
    return this.logs.slice(-limit);
  }

  static getLogsByType(type: SecurityEventType, limit: number = 100): SecurityEvent[] {
    return this.logs
      .filter(log => log.type === type)
      .slice(-limit);
  }

  static getLogsByUser(userId: string, limit: number = 100): SecurityEvent[] {
    return this.logs
      .filter(log => log.userId === userId)
      .slice(-limit);
  }

  private static generateId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Security event types and interfaces
export type SecurityEventType =
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'AUTH_LOGOUT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'FILE_UPLOAD_BLOCKED'
  | 'SQL_INJECTION_ATTEMPT'
  | 'XSS_ATTEMPT'
  | 'BRUTE_FORCE_ATTEMPT'
  | 'UNAUTHORIZED_ACCESS'
  | 'INVALID_TOKEN'
  | 'EXPIRED_TOKEN';

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  message: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  details?: Record<string, any>;
}

// Export default configuration
export { getDefaultConfig as securityConfig };