import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PhaseCompletion {
  phase1: boolean;
  phase2: boolean;
  phase3: boolean;
  phase4: boolean;
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
   * Calculate Phase 4 completion (Project Information)
   * This requires checking if user has projects with required fields
   */
  static async calculatePhase4(userId: string): Promise<boolean> {
    // Check if user has any projects
    const projects = await prisma.project.findMany({
      where: {
        team: {
          team_members: {
            some: {
              user_id: userId
            }
          }
        }
      },
      take: 1
    });

    if (projects.length === 0) {
      return false; // No projects, Phase 4 not applicable yet
    }

    // Check if at least one project has required fields
    const projectWithDetails = projects.find(p => 
      p.status_at_enrollment && 
      p.challenge_description
    );

    return !!projectWithDetails;
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
   */
  static async calculateCompletion(userId: string, user: any): Promise<ProfileCompletionData> {
    const phase1 = this.calculatePhase1(user);
    const phase2 = this.calculatePhase2(user);
    const phase3 = this.calculatePhase3(user);
    const phase4 = await this.calculatePhase4(userId);
    const phase5 = this.calculatePhase5(user);

    const phases: PhaseCompletion = {
      phase1,
      phase2,
      phase3,
      phase4,
      phase5
    };

    // Calculate percentage
    // Phase 1-3 are required (60%), Phase 4 is required if user has projects (20%), Phase 5 is optional (20%)
    let completedPhases = 0;
    let totalPhases = 3; // Phase 1-3 are always counted

    if (phase1) completedPhases++;
    if (phase2) completedPhases++;
    if (phase3) completedPhases++;

    // Phase 4: Check if user has projects, if yes, it's required
    const hasProjects = await prisma.project.findFirst({
      where: {
        team: {
          team_members: {
            some: {
              user_id: userId
            }
          }
        }
      }
    });

    if (hasProjects) {
      totalPhases++; // Phase 4 is required
      if (phase4) completedPhases++;
    }

    // Phase 5 is optional, but counts if completed
    if (phase5) {
      completedPhases++;
    }

    // Calculate percentage
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
    if (hasProjects && !phase4) {
      missingFields.push('project status_at_enrollment');
      missingFields.push('project challenge_description');
    }

    return {
      percentage,
      phases,
      missingFields
    };
  }

  /**
   * Get missing fields for a specific phase
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
    }

    return missing;
  }
}

