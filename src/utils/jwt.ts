import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Warn if JWT_SECRET is not set (important for security)
if (!process.env.JWT_SECRET) {
  console.error('⚠️ WARNING: JWT_SECRET is not set in environment variables! Using default value.');
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
  teamId?: string;
}

export class JWTUtils {
  /**
   * Generate JWT token for user
   */
  static generateToken(user: User, teamId?: string): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      ...(teamId && { teamId }),
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'incubation-management-system',
      audience: 'incubation-users',
    } as jwt.SignOptions);
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'incubation-management-system',
        audience: 'incubation-users',
      }) as JWTPayload;

      return decoded;
    } catch (error: any) {
      console.error('❌ JWT Verification failed:', {
        error: error.message,
        name: error.name,
        expiredAt: error.expiredAt,
        jwtSecretSet: !!JWT_SECRET,
        jwtSecretLength: JWT_SECRET?.length || 0
      });
      
      // Provide more specific error messages
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired. Please log in again.');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token format or signature');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not yet valid');
      } else {
        throw new Error(`Invalid or expired token: ${error.message}`);
      }
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  /**
   * Generate refresh token (longer expiry)
   */
  static generateRefreshToken(user: User, teamId?: string): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      ...(teamId && { teamId }),
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: '7d', // 7 days for refresh token
      issuer: 'incubation-management-system',
      audience: 'incubation-refresh-tokens',
    });
  }
}