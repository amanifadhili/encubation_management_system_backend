import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PhaseCompletion {
  phase1: boolean;
  phase2: boolean;
  phase3: boolean;
  phase5: boolean;
}

export interface ProfileCompletionData {
  percentage: number;
  phases: PhaseCompletion;
  missingFields: string[];
}

/**
 * Calculate profile completion for a user
 */
export class ProfileCompletionCalculator {
  /**
   * Calculate Phase 1 completion (Essential Information)
   */
  static calculatePhase1(user: any): boolean {
    return !!(
      user.first_name &&
      user.last_name &&
      user.phone
    );
  }

  /**
   * Calculate Phase 2 completion (Academic Profile)
   */
  static calculatePhase2(user: any): boolean {
    return !!(
      user.enrollment_status &&
      user.major_program &&
      user.program_of_study &&
      user.graduation_year
    );
  }

  /**
   * Calculate Phase 3 completion (Professional Profile)
   */
  static calculatePhase3(user: any): boolean {
    // Parse skills if it's a string
    let skills = user.skills;
    if (typeof skills === 'string' && skills.trim() !== '' && skills !== 'null') {
      try {
        skills = JSON.parse(skills);
      } catch (e) {
        skills = null;
      }
    }
    
    const hasSkills = skills && (
      (Array.isArray(skills) && skills.length > 0) ||
      (typeof skills === 'object' && Object.keys(skills).length > 0)
    );
    
    // Parse support_interests if it's a string
    let supportInterests = user.support_interests;
    if (typeof supportInterests === 'string' && supportInterests.trim() !== '' && supportInterests !== 'null') {
      try {
        supportInterests = JSON.parse(supportInterests);
      } catch (e) {
        supportInterests = null;
      }
    }
    
    const hasInterests = supportInterests && (
      (Array.isArray(supportInterests) && supportInterests.length > 0) ||
      (typeof supportInterests === 'object' && Object.keys(supportInterests).length > 0)
    );

    return !!(
      user.current_role &&
      hasSkills &&
      hasInterests
    );
  }

  /**
   * Phase 4 (Project Information) has been moved to Projects page.
   * Projects are now managed separately and are not part of profile completion.
   * This method is kept for backward compatibility but always returns true.
   * @deprecated Phase 4 is no longer part of profile completion
   */
  static async calculatePhase4(userId: string): Promise<boolean> {
    // Phase 4 is no longer part of profile completion
    // Projects are managed separately in the Projects page
    return true;
  }

  /**
   * Calculate Phase 5 completion (Additional Information)
   */
  static calculatePhase5(user: any): boolean {
    // Phase 5 is optional, but if user has additional_notes, consider it complete
    return !!user.additional_notes && user.additional_notes.trim() !== '';
  }

  /**
   * Calculate overall profile completion
   * Phase 4 (Project Information) has been moved to Projects page and is no longer part of profile completion.
   * Profile now consists of 4 phases: Phase 1-3 (required, 75%) and Phase 5 (optional, 25%).
   */
  static async calculateCompletion(userId: string, user: any): Promise<ProfileCompletionData> {
    const phase1 = this.calculatePhase1(user);
    const phase2 = this.calculatePhase2(user);
    const phase3 = this.calculatePhase3(user);
    const phase5 = this.calculatePhase5(user);

    const phases: PhaseCompletion = {
      phase1,
      phase2,
      phase3,
      phase5
    };

    // Calculate percentage
    // Phase 1-3 are required (75% total), Phase 5 is optional (25%)
    // Total: 4 phases, but Phase 5 is optional
    let completedPhases = 0;
    const totalPhases = 4; // Phase 1, 2, 3, 5

    if (phase1) completedPhases++;
    if (phase2) completedPhases++;
    if (phase3) completedPhases++;
    if (phase5) completedPhases++;

    // Calculate percentage: (completed / total) * 100
    // Since Phase 5 is optional, max is 100% if all 4 are complete
    // But we can also calculate as: Phase 1-3 (75%) + Phase 5 (25%)
    const percentage = Math.round((completedPhases / totalPhases) * 100);

    // Identify missing fields
    const missingFields: string[] = [];
    if (!phase1) {
      if (!user.first_name) missingFields.push('first_name');
      if (!user.last_name) missingFields.push('last_name');
      if (!user.phone) missingFields.push('phone');
    }
    if (!phase2) {
      if (!user.enrollment_status) missingFields.push('enrollment_status');
      if (!user.major_program) missingFields.push('major_program');
      if (!user.program_of_study) missingFields.push('program_of_study');
      if (!user.graduation_year) missingFields.push('graduation_year');
    }
    if (!phase3) {
      if (!user.current_role) missingFields.push('current_role');
      if (!user.skills) missingFields.push('skills');
      if (!user.support_interests) missingFields.push('support_interests');
    }

    return {
      percentage,
      phases,
      missingFields
    };
  }

  /**
   * Get missing fields for a specific phase
   * Phase 4 is no longer part of profile completion (moved to Projects page)
   */
  static getMissingFieldsForPhase(user: any, phase: number): string[] {
    const missing: string[] = [];

    switch (phase) {
      case 1:
        if (!user.first_name) missing.push('first_name');
        if (!user.last_name) missing.push('last_name');
        if (!user.phone) missing.push('phone');
        break;
      case 2:
        if (!user.enrollment_status) missing.push('enrollment_status');
        if (!user.major_program) missing.push('major_program');
        if (!user.program_of_study) missing.push('program_of_study');
        if (!user.graduation_year) missing.push('graduation_year');
        break;
      case 3:
        if (!user.current_role) missing.push('current_role');
        if (!user.skills) missing.push('skills');
        if (!user.support_interests) missing.push('support_interests');
        break;
      case 4:
        // Phase 4 has been moved to Projects page
        // Return empty array as it's no longer part of profile
        break;
      case 5:
        // Phase 5 is optional, no missing fields required
        break;
    }

    return missing;
  }
}

