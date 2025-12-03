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
   * Generate a default password based on user role
   * Format: [Role]@[Year][SpecialChar][RandomNum]
   * Example: Manager@2024!1234
   * This format ensures:
   * - Uppercase: First letter of role name
   * - Lowercase: Rest of role name
   * - Number: Year + random 4-digit number
   * - Special character: @ and another special char
   * - Length: Always > 8 characters
   */
  static generateDefaultPassword(role: string): string {
    const roleMap: Record<string, string> = {
      director: 'Director',
      manager: 'Manager',
      mentor: 'Mentor',
      incubator: 'Incubator'
    };

    const currentYear = new Date().getFullYear();
    const roleName = roleMap[role.toLowerCase()] || 'User';
    const specialChars = '!@#$%^&*';
    const specialChar = specialChars[Math.floor(Math.random() * specialChars.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random number

    // Format: Role@YearSpecialCharRandomNum
    // Example: Director@2024!1234
    // This format guarantees:
    // - Uppercase letter (first char of role)
    // - Lowercase letters (rest of role name)
    // - Numbers (year + randomNum)
    // - Special characters (@ and another special char)
    // - Length always > 8
    const password = `${roleName}@${currentYear}${specialChar}${randomNum}`;

    return password;
  }
}