import prisma from '../config/database';

/**
 * Get email addresses of all team members
 */
export async function getTeamMemberEmails(teamId: string): Promise<string[]> {
  try {
    const teamMembers = await prisma.teamMember.findMany({
      where: { team_id: teamId },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });

    return teamMembers.map(member => member.user.email);
  } catch (error) {
    console.error('Error getting team member emails:', error);
    return [];
  }
}

/**
 * Get email addresses of all managers
 */
export async function getManagerEmails(): Promise<string[]> {
  try {
    const managers = await prisma.user.findMany({
      where: {
        role: {
          in: ['manager', 'director']
        }
      },
      select: {
        email: true
      }
    });

    return managers.map(user => user.email);
  } catch (error) {
    console.error('Error getting manager emails:', error);
    return [];
  }
}

/**
 * Get email address of mentor assigned to a team
 */
export async function getTeamMentorEmail(teamId: string): Promise<string | null> {
  try {
    const mentorAssignment = await prisma.mentorAssignment.findFirst({
      where: { team_id: teamId },
      include: {
        mentor: {
          include: {
            user: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });

    return mentorAssignment?.mentor.user.email || null;
  } catch (error) {
    console.error('Error getting team mentor email:', error);
    return null;
  }
}

/**
 * Get email addresses of all mentors assigned to a team
 */
export async function getTeamMentorEmails(teamId: string): Promise<string[]> {
  try {
    const mentorAssignments = await prisma.mentorAssignment.findMany({
      where: { team_id: teamId },
      include: {
        mentor: {
          include: {
            user: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });

    return mentorAssignments.map(assignment => assignment.mentor.user.email);
  } catch (error) {
    console.error('Error getting team mentor emails:', error);
    return [];
  }
}

/**
 * Get email addresses of team leader
 */
export async function getTeamLeaderEmail(teamId: string): Promise<string | null> {
  try {
    const teamLeader = await prisma.teamMember.findFirst({
      where: {
        team_id: teamId,
        role: 'team_leader'
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });

    return teamLeader?.user.email || null;
  } catch (error) {
    console.error('Error getting team leader email:', error);
    return null;
  }
}

/**
 * Get combined recipient list for team-related emails
 * Returns team members, mentors, and managers
 */
export async function getTeamNotificationRecipients(teamId: string, includeManagers: boolean = true): Promise<string[]> {
  const emails: string[] = [];

  // Get team members
  const memberEmails = await getTeamMemberEmails(teamId);
  emails.push(...memberEmails);

  // Get mentors
  const mentorEmails = await getTeamMentorEmails(teamId);
  emails.push(...mentorEmails);

  // Get managers if requested
  if (includeManagers) {
    const managerEmails = await getManagerEmails();
    emails.push(...managerEmails);
  }

  // Remove duplicates
  return [...new Set(emails)];
}
