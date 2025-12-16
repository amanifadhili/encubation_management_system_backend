import nodemailer, { Transporter } from 'nodemailer';
import path from 'path';
import fs from 'fs';
import handlebars from 'handlebars';
import prisma from '../config/database';
import { createTransporter, getEmailConfig } from '../config/email';
import { EmailPreferencesController } from '../controllers/emailPreferencesController';

export type EmailType = 'user_created' | 'user_updated' | 'team_updates' | 'project_updates' | 'notifications' | 'messages' | 'announcements' | 'material_requests' | 'inventory_updates';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  templateData?: Record<string, any>;
  html?: string;
  text?: string;
  emailType?: EmailType;
  userId?: string;
  retries?: number; // Number of retry attempts (default: 3)
  priority?: 'high' | 'normal' | 'low'; // Email priority
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retries?: number; // Number of retry attempts made
}

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

// Template cache for performance optimization
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

class EmailService {
  private transporter: Transporter | null = null;
  private templatesDir: string;
  private retryConfig: RetryConfig;
  private connectionPool: Transporter[] = [];
  private maxPoolSize: number;
  private batchSize: number;
  private rateLimitDelay: number;

  constructor() {
    this.templatesDir = path.join(__dirname, '../../templates/emails');
    this.transporter = createTransporter();
    
    // Retry configuration from environment or defaults
    this.retryConfig = {
      maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || '3', 10),
      initialDelay: parseInt(process.env.EMAIL_RETRY_INITIAL_DELAY || '1000', 10),
      maxDelay: parseInt(process.env.EMAIL_RETRY_MAX_DELAY || '10000', 10),
      backoffMultiplier: parseFloat(process.env.EMAIL_RETRY_BACKOFF || '2'),
    };

    // Connection pool configuration
    this.maxPoolSize = parseInt(process.env.EMAIL_POOL_SIZE || '3', 10);
    this.batchSize = parseInt(process.env.EMAIL_BATCH_SIZE || '10', 10);
    this.rateLimitDelay = parseInt(process.env.EMAIL_RATE_LIMIT_DELAY || '100', 10);

    // Initialize connection pool
    this.initializeConnectionPool();
  }

  /**
   * Initialize connection pool for better performance
   */
  private initializeConnectionPool(): void {
    if (!this.isEnabled()) {
      return;
    }

    try {
      for (let i = 0; i < this.maxPoolSize; i++) {
        const transporter = createTransporter();
        if (transporter) {
          this.connectionPool.push(transporter);
        }
      }
    } catch (error) {
      console.error('❌ Failed to initialize email connection pool:', error);
    }
  }

  /**
   * Get transporter from pool (round-robin)
   */
  private getTransporter(): Transporter | null {
    if (!this.isEnabled()) {
      return null;
    }

    // Use connection pool if available, otherwise use default transporter
    if (this.connectionPool.length > 0) {
      const index = Math.floor(Math.random() * this.connectionPool.length);
      return this.connectionPool[index];
    }

    return this.transporter;
  }

  /**
   * Check if email service is enabled and configured
   */
  private isEnabled(): boolean {
    const config = getEmailConfig();
    return config.enabled && this.transporter !== null;
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: { maxRetries?: number; onRetry?: (attempt: number, delay: number) => void } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries || this.retryConfig.maxRetries;
    let lastError: any;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        attempt++;

        // Don't retry on certain errors
        if (error.code === 'EAUTH' || error.code === 'EENVELOPE') {
          throw error; // Don't retry authentication or envelope errors
        }

        if (attempt >= maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay
        );

        if (options.onRetry) {
          options.onRetry(attempt, delay);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Check if user wants to receive this type of email
   */
  private async shouldSendEmailToUser(userId: string | undefined, emailType: EmailType | undefined): Promise<boolean> {
    if (!userId || !emailType) {
      return true;
    }

    try {
      return await EmailPreferencesController.shouldSendEmail(userId, emailType);
    } catch (error) {
      console.error('Error checking email preference:', error);
      return true;
    }
  }

  /**
   * Get user ID from email address
   */
  private async getUserIdFromEmail(email: string): Promise<string | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true }
      });
      return user?.id || null;
    } catch (error) {
      console.error('Error getting user ID from email:', error);
      return null;
    }
  }

  /**
   * Render email template with Handlebars (with caching)
   */
  private async renderTemplate(templateName: string, data: Record<string, any>): Promise<string> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
      
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templateName}`);
      }

      // Check cache first
      let template: HandlebarsTemplateDelegate | undefined = templateCache.get(templateName);
      
      // If not cached, compile and cache it
      if (!template) {
        let templateContent = fs.readFileSync(templatePath, 'utf-8');
        const layoutMatch = templateContent.match(/^{{!<\s*layouts\/([^}]+)\s*}}/);
        
        if (layoutMatch) {
          const layoutName = layoutMatch[1];
          const layoutPath = path.join(this.templatesDir, `layouts/${layoutName}.hbs`);
          
          if (fs.existsSync(layoutPath)) {
            let layoutContent = fs.readFileSync(layoutPath, 'utf-8');
            templateContent = templateContent.replace(/^{{!<\s*layouts\/[^}]+\s*}}\s*/, '');
            layoutContent = layoutContent.replace('{{{body}}}', templateContent);
            templateContent = layoutContent;
          }
        }

        template = handlebars.compile(templateContent);
        templateCache.set(templateName, template);
      }

      return template(data);
    } catch (error) {
      console.error(`Error rendering template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Clear template cache (useful for development)
   */
  public clearTemplateCache(): void {
    templateCache.clear();
  }

  /**
   * Log email to database
   */
  private async logEmail(
    recipient: string,
    subject: string,
    templateName: string | null,
    status: 'PENDING' | 'SENT' | 'FAILED',
    errorMessage?: string,
    messageId?: string
  ): Promise<void> {
    try {
      await prisma.emailLog.create({
        data: {
          recipient,
          subject,
          template_name: templateName || 'none',
          status,
          error_message: errorMessage || null,
          sent_at: status === 'SENT' ? new Date() : null,
        },
      });
    } catch (error) {
      console.error('Failed to log email:', error);
      // Don't throw - logging failure shouldn't break email sending
    }
  }

  /**
   * Send email with retry logic
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    if (!this.isEnabled()) {
      const errorMsg = 'Email service is disabled or not configured';
      console.warn(`⚠️  ${errorMsg}`);
      
      const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      await this.logEmail(recipients, options.subject, options.template || null, 'FAILED', errorMsg);
      
      return {
        success: false,
        error: errorMsg,
        retries: 0,
      };
    }

    const maxRetries = options.retries || this.retryConfig.maxRetries;
    let retryAttempts = 0;

    try {
      let recipients = Array.isArray(options.to) ? options.to : [options.to];
      const config = getEmailConfig();

      // Filter recipients based on email preferences
      if (options.emailType) {
        const filteredRecipients: string[] = [];
        
        for (const recipient of recipients) {
          let userId = options.userId;
          if (!userId) {
            userId = await this.getUserIdFromEmail(recipient) || undefined;
          }

          const shouldSend = await this.shouldSendEmailToUser(userId, options.emailType);
          
          if (shouldSend) {
            filteredRecipients.push(recipient);
          }
        }

        if (filteredRecipients.length === 0) {
          return {
            success: true,
            messageId: undefined,
            retries: 0,
          };
        }

        recipients = filteredRecipients;
      }

      // Render template if provided
      let html = options.html;
      if (options.template) {
        html = await this.renderTemplate(options.template, options.templateData || {});
      }

      // Log email as pending
      for (const recipient of recipients) {
        await this.logEmail(recipient, options.subject, options.template || null, 'PENDING');
      }

      // Send email with retry logic
      const transporter = this.getTransporter();
      if (!transporter) {
        throw new Error('Email transporter not available');
      }

      const mailOptions = {
        from: `"${config.from.name}" <${config.from.address}>`,
        to: recipients.join(', '),
        subject: options.subject,
        html: html || options.html,
        text: options.text || this.htmlToText(html || ''),
        priority: options.priority || 'normal',
      };

      const info = await this.retryWithBackoff(
        () => transporter.sendMail(mailOptions),
        {
          maxRetries,
          onRetry: (attempt, delay) => {
            retryAttempts = attempt;
          }
        }
      );

      // Update logs to sent
      for (const recipient of recipients) {
        await this.logEmail(
          recipient,
          options.subject,
          options.template || null,
          'SENT',
          undefined,
          info.messageId
        );
      }
      
      return {
        success: true,
        messageId: info.messageId,
        retries: retryAttempts,
      };
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      console.error('❌ Failed to send email:', errorMsg);
      console.error('Error details:', error);

      // Update logs to failed
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      for (const recipient of recipients) {
        await this.logEmail(
          recipient,
          options.subject,
          options.template || null,
          'FAILED',
          errorMsg
        );
      }

      return {
        success: false,
        error: errorMsg,
        retries: retryAttempts,
      };
    }
  }

  /**
   * Send bulk emails with batching and rate limiting
   */
  async sendBulkEmail(options: EmailOptions[]): Promise<EmailResult[]> {
    const results: EmailResult[] = [];
    
    // Process in batches to avoid overwhelming the SMTP server
    for (let i = 0; i < options.length; i += this.batchSize) {
      const batch = options.slice(i, i + this.batchSize);
      
      // Send batch in parallel
      const batchPromises = batch.map(async (option, index) => {
        // Add small delay between emails in batch to respect rate limits
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
        }
        return this.sendEmail(option);
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process batch results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Unknown error',
            retries: 0,
          });
        }
      });

      // Delay between batches
      if (i + this.batchSize < options.length) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay * 2));
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    return results;
  }

  /**
   * Get email statistics
   */
  async getEmailStatistics(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    successRate: number;
  }> {
    try {
      const where: any = {};
      
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = startDate;
        if (endDate) where.created_at.lte = endDate;
      }

      const [total, sent, failed, pending] = await Promise.all([
        prisma.emailLog.count({ where }),
        prisma.emailLog.count({ where: { ...where, status: 'SENT' } }),
        prisma.emailLog.count({ where: { ...where, status: 'FAILED' } }),
        prisma.emailLog.count({ where: { ...where, status: 'PENDING' } }),
      ]);

      const successRate = total > 0 ? (sent / total) * 100 : 0;

      return {
        total,
        sent,
        failed,
        pending,
        successRate: Math.round(successRate * 100) / 100,
      };
    } catch (error) {
      console.error('Error getting email statistics:', error);
      throw error;
    }
  }

  /**
   * Simple HTML to text converter
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Verify email service connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const transporter = this.getTransporter();
      if (!transporter) {
        return false;
      }

      await transporter.verify();
      return true;
    } catch (error) {
      console.error('Email connection verification failed:', error);
      return false;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
    }
    
    for (const transporter of this.connectionPool) {
      transporter.close();
    }
    
    this.connectionPool = [];
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
