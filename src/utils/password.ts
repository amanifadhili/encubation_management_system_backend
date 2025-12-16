import bcrypt from 'bcryptjs';

export class PasswordUtils {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hash a password
   */
  static async hash(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify a password against its hash
   */
  static async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if password meets security requirements
   */
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a deterministic default password based on user role.
   * - No randomness: the same role always gets the same default password.
   * - Still meets complexity rules (upper, lower, number, special, length > 8).
   * Format: [Role]@[BaseYear]!
   * Example: Manager@2024!
   */
  static generateDefaultPassword(role: string): string {
    const roleMap: Record<string, string> = {
      director: 'Director',
      manager: 'Manager',
      mentor: 'Mentor',
      incubator: 'Incubator'
    };

    const baseYear = 2024; // fixed to keep output stable across calls
    const roleName = roleMap[role.toLowerCase()] || 'User';

    // Deterministic format; no random component
    const password = `${roleName}@${baseYear}!`;

    return password;
  }
}