import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    address: string;
  };
}

/**
 * Get email configuration from environment variables
 * 
 * Required environment variables:
 * - EMAIL_ENABLED: Enable/disable email service (default: false)
 * - EMAIL_HOST: SMTP host (default: smtp.gmail.com)
 * - EMAIL_PORT: SMTP port (default: 587)
 * - EMAIL_SECURE: Use secure connection (default: false)
 * - EMAIL_USER: SMTP username/email
 * - EMAIL_PASSWORD: SMTP password (use app-specific password for Gmail)
 * - EMAIL_FROM_NAME: Sender name (default: "Incubation Management System")
 * - EMAIL_FROM_ADDRESS: Sender email address (defaults to EMAIL_USER)
 * 
 * Optional optimization environment variables:
 * - EMAIL_MAX_RETRIES: Maximum retry attempts (default: 3)
 * - EMAIL_RETRY_INITIAL_DELAY: Initial retry delay in ms (default: 1000)
 * - EMAIL_RETRY_MAX_DELAY: Maximum retry delay in ms (default: 10000)
 * - EMAIL_RETRY_BACKOFF: Exponential backoff multiplier (default: 2)
 * - EMAIL_POOL_SIZE: Connection pool size (default: 3)
 * - EMAIL_BATCH_SIZE: Batch size for bulk emails (default: 10)
 * - EMAIL_RATE_LIMIT_DELAY: Delay between emails in ms (default: 100)
 */
export const getEmailConfig = (): EmailConfig => {
  const enabled = process.env.EMAIL_ENABLED === 'true';
  
  return {
    enabled,
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true', // false for 587, true for 465
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASSWORD || '',
    },
    from: {
      name: process.env.EMAIL_FROM_NAME || 'Incubation Management System',
      address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || '',
    },
  };
};

/**
 * Create and configure nodemailer transporter
 * 
 * @returns Configured nodemailer transporter or null if disabled/invalid
 */
export const createTransporter = () => {
  const config = getEmailConfig();
  
  if (!config.enabled) {
    console.warn('⚠️  Email service is disabled. Set EMAIL_ENABLED=true to enable.');
    return null;
  }

  if (!config.auth.user || !config.auth.pass) {
    console.error('❌ Email credentials not configured. Please set EMAIL_USER and EMAIL_PASSWORD.');
    return null;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
      // Gmail specific settings
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production', // Reject unauthorized certs in production
      },
      // Connection pool settings
      pool: true,
      maxConnections: parseInt(process.env.EMAIL_POOL_SIZE || '3', 10),
      maxMessages: 100, // Maximum messages per connection
    });

    // Verify connection (async, don't wait)
    transporter.verify((error) => {
      if (error) {
        console.error('❌ Email transporter verification failed:', error);
      } else {
        console.log('✅ Email transporter configured successfully');
      }
    });

    return transporter;
  } catch (error) {
    console.error('❌ Failed to create email transporter:', error);
    return null;
  }
};

/**
 * Get default email configuration
 */
export const getDefaultEmailConfig = () => getEmailConfig();

export default createTransporter;
