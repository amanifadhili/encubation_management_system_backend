import { Request, Response } from 'express';
import prisma from '../config/database';

interface ReportsResponse {
  success: boolean;
  message: string;
  data?: any;
}

export class ReportsController {
  /**
   * Get team assignment reports
   */
  static async getTeamReports(req: Request, res: Response): Promise<void> {
    try {
      const { category, status, start_date, end_date } = req.query;

      // Get basic team data
      const teams = await prisma.team.findMany({
        where: {
          status: status as any || undefined
        },
        orderBy: { created_at: 'desc' }
      });

      // Get detailed data for each team
      const teamsWithDetails = await Promise.all(
        teams.map(async (team) => {
          const [memberCount, projectCount, mentorCount, inventoryCount, requestCount] = await Promise.all([
            prisma.teamMember.count({ where: { team_id: team.id } }),
            prisma.project.count({ where: { team_id: team.id } }),
            prisma.mentorAssignment.count({ where: { team_id: team.id } }),
            prisma.inventoryAssignment.count({ where: { team_id: team.id, returned_at: null } }),
            prisma.materialRequest.count({ where: { team_id: team.id } })
          ]);

          return {
            id: team.id,
            team_name: team.team_name,
            company_name: team.company_name,
            status: team.status,
            created_at: team.created_at,
            member_count: memberCount,
            project_count: projectCount,
            mentor_count: mentorCount,
            inventory_assignments: inventoryCount,
            material_requests: requestCount
          };
        })
      );

      // Calculate summary statistics
      const summary = {
        total_teams: teamsWithDetails.length,
        active_teams: teamsWithDetails.filter(t => t.status === 'active').length,
        pending_teams: teamsWithDetails.filter(t => t.status === 'pending').length,
        completed_teams: teamsWithDetails.filter(t => t.status === 'inactive').length,
        total_projects: teamsWithDetails.reduce((sum, team) => sum + team.project_count, 0),
        total_members: teamsWithDetails.reduce((sum, team) => sum + team.member_count, 0),
        total_mentors: teamsWithDetails.reduce((sum, team) => sum + team.mentor_count, 0)
      };

      res.json({
        success: true,
        message: 'Team reports retrieved successfully',
        data: {
          summary,
          teams: teamsWithDetails,
          filters: {
            category,
            status,
            date_range: start_date && end_date ? { start_date, end_date } : null
          }
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get team reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get inventory reports
   */
  static async getInventoryReports(req: Request, res: Response): Promise<void> {
    try {
      // Get all inventory items with assignment details
      const inventoryItems = await prisma.inventoryItem.findMany({
        include: {
          inventory_assignments: {
            where: {
              returned_at: null // Only active assignments
            },
            include: {
              team: {
                select: {
                  id: true,
                  team_name: true,
                  company_name: true
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      // Calculate inventory statistics
      const summary = {
        total_items: inventoryItems.length,
        available_items: inventoryItems.filter(item => item.status === 'available').length,
        low_stock_items: inventoryItems.filter(item => item.status === 'low_stock').length,
        out_of_stock_items: inventoryItems.filter(item => item.status === 'out_of_stock').length,
        total_quantity: inventoryItems.reduce((sum, item) => sum + item.total_quantity, 0),
        assigned_quantity: inventoryItems.reduce((sum, item) => sum + item.inventory_assignments.length, 0),
        available_quantity: inventoryItems.reduce((sum, item) => sum + Math.max(0, item.available_quantity), 0)
      };

      // Group assignments by team
      const teamAssignments = inventoryItems.reduce((acc, item) => {
        item.inventory_assignments.forEach(assignment => {
          const teamId = assignment.team.id;
          if (!acc[teamId]) {
            acc[teamId] = {
              team: assignment.team,
              items: []
            };
          }
          acc[teamId].items.push({
            item_id: item.id,
            item_name: item.name,
            quantity: assignment.quantity,
            assigned_at: assignment.assigned_at
          });
        });
        return acc;
      }, {} as any);

      // Format inventory data
      const formattedInventory = inventoryItems.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        total_quantity: item.total_quantity,
        available_quantity: item.available_quantity,
        status: item.status,
        assigned_count: item.inventory_assignments.length,
        utilization_rate: item.total_quantity > 0 ?
          ((item.inventory_assignments.length / item.total_quantity) * 100).toFixed(1) : '0',
        created_at: item.created_at,
        assignments: item.inventory_assignments.map(assignment => ({
          id: assignment.id,
          team: assignment.team,
          quantity: assignment.quantity,
          assigned_at: assignment.assigned_at
        }))
      }));

      res.json({
        success: true,
        message: 'Inventory reports retrieved successfully',
        data: {
          summary,
          inventory: formattedInventory,
          team_assignments: Object.values(teamAssignments)
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get inventory reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get project reports
   */
  static async getProjectReports(req: Request, res: Response): Promise<void> {
    try {
      const { category, status, team_id, start_date, end_date } = req.query;

      // Build where clause
      const where: any = {};

      if (category) {
        where.category = category as any;
      }

      if (status) {
        where.status = status as any;
      }

      if (team_id) {
        where.team_id = team_id as string;
      }

      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) {
          where.created_at.gte = new Date(start_date as string);
        }
        if (end_date) {
          where.created_at.lte = new Date(end_date as string);
        }
      }

      // Get projects with team and file information
      const projects = await prisma.project.findMany({
        where,
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true,
              status: true
            }
          },
          project_files: {
            select: {
              id: true,
              file_name: true,
              file_type: true,
              file_size: true,
              uploaded_at: true
            },
            orderBy: { uploaded_at: 'desc' }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      // Calculate project statistics
      const summary = {
        total_projects: projects.length,
        active_projects: projects.filter(p => p.status === 'active').length,
        pending_projects: projects.filter(p => p.status === 'pending').length,
        completed_projects: projects.filter(p => p.status === 'completed').length,
        on_hold_projects: projects.filter(p => p.status === 'on_hold').length,
        average_progress: projects.length > 0 ?
          (projects.reduce((sum, p) => sum + p.progress, 0) / projects.length).toFixed(1) : '0',
        total_files: projects.reduce((sum, p) => sum + p.project_files.length, 0)
      };

      // Group projects by category
      const categoryStats = projects.reduce((acc, project) => {
        if (!acc[project.category]) {
          acc[project.category] = {
            count: 0,
            total_progress: 0,
            completed: 0
          };
        }
        acc[project.category].count++;
        acc[project.category].total_progress += project.progress;
        if (project.status === 'completed') {
          acc[project.category].completed++;
        }
        return acc;
      }, {} as any);

      // Calculate category averages
      Object.keys(categoryStats).forEach(category => {
        const stats = categoryStats[category];
        stats.average_progress = (stats.total_progress / stats.count).toFixed(1);
        stats.completion_rate = ((stats.completed / stats.count) * 100).toFixed(1);
      });

      // Format project data
      const formattedProjects = projects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        category: project.category,
        status: project.status,
        progress: project.progress,
        team: project.team,
        file_count: project.project_files.length,
        created_at: project.created_at,
        updated_at: project.updated_at,
        recent_files: project.project_files.slice(0, 3) // Last 3 files
      }));

      res.json({
        success: true,
        message: 'Project reports retrieved successfully',
        data: {
          summary,
          category_stats: categoryStats,
          projects: formattedProjects,
          filters: {
            category,
            status,
            team_id,
            date_range: start_date && end_date ? { start_date, end_date } : null
          }
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get project reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get dashboard analytics data
   */
  static async getDashboardAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // Get user role for filtering data
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      let analyticsData: any = {};

      // Base analytics for all roles
      const [totalTeams, totalProjects, totalInventory, totalRequests] = await Promise.all([
        prisma.team.count(),
        prisma.project.count(),
        prisma.inventoryItem.count(),
        prisma.materialRequest.count()
      ]);

      analyticsData.summary = {
        total_teams: totalTeams,
        total_projects: totalProjects,
        total_inventory: totalInventory,
        total_requests: totalRequests
      };

      // Role-specific data
      switch (userRole) {
        case 'director':
          analyticsData.detailed = await ReportsController.getDirectorAnalytics();
          break;

        case 'manager':
          analyticsData.detailed = await ReportsController.getManagerAnalytics();
          break;

        case 'mentor':
          analyticsData.detailed = await ReportsController.getMentorAnalytics(userId);
          break;

        case 'incubator':
          analyticsData.detailed = await ReportsController.getIncubatorAnalytics(userId);
          break;
      }

      res.json({
        success: true,
        message: 'Dashboard analytics retrieved successfully',
        data: analyticsData
      } as ReportsResponse);

    } catch (error) {
      console.error('Get dashboard analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Export reports as data (for PDF generation)
   */
  static async exportReport(req: Request, res: Response): Promise<void> {
    try {
      console.log('Export report called with body:', req.body);
      console.log('User:', req.user);

      const { report_type, filters = {} } = req.body;

      if (!report_type) {
        console.log('No report_type provided');
        res.status(400).json({
          success: false,
          message: 'Report type is required'
        } as ReportsResponse);
        return;
      }

      console.log('Processing report type:', report_type);

      let exportData: any = {};

      switch (report_type) {
        case 'teams':
          // Get team reports data without sending response
          const { category, status, start_date, end_date } = req.query;

          const teams = await prisma.team.findMany({
            where: {
              status: status as any || undefined
            },
            orderBy: { created_at: 'desc' }
          });

          const teamsWithDetails = await Promise.all(
            teams.map(async (team) => {
              const [memberCount, projectCount, mentorCount, inventoryCount, requestCount] = await Promise.all([
                prisma.teamMember.count({ where: { team_id: team.id } }),
                prisma.project.count({ where: { team_id: team.id } }),
                prisma.mentorAssignment.count({ where: { team_id: team.id } }),
                prisma.inventoryAssignment.count({ where: { team_id: team.id, returned_at: null } }),
                prisma.materialRequest.count({ where: { team_id: team.id } })
              ]);

              return {
                id: team.id,
                team_name: team.team_name,
                company_name: team.company_name,
                status: team.status,
                created_at: team.created_at,
                member_count: memberCount,
                project_count: projectCount,
                mentor_count: mentorCount,
                inventory_assignments: inventoryCount,
                material_requests: requestCount
              };
            })
          );

          const summary = {
            total_teams: teamsWithDetails.length,
            active_teams: teamsWithDetails.filter(t => t.status === 'active').length,
            pending_teams: teamsWithDetails.filter(t => t.status === 'pending').length,
            completed_teams: teamsWithDetails.filter(t => t.status === 'inactive').length,
            total_projects: teamsWithDetails.reduce((sum, team) => sum + team.project_count, 0),
            total_members: teamsWithDetails.reduce((sum, team) => sum + team.member_count, 0),
            total_mentors: teamsWithDetails.reduce((sum, team) => sum + team.mentor_count, 0)
          };

          exportData = {
            summary,
            teams: teamsWithDetails,
            generated_at: new Date().toISOString()
          };
          break;

        case 'inventory':
          // Get inventory reports data
          const inventoryItems = await prisma.inventoryItem.findMany({
            include: {
              inventory_assignments: {
                where: { returned_at: null },
                include: {
                  team: {
                    select: {
                      id: true,
                      team_name: true,
                      company_name: true
                    }
                  }
                }
              }
            },
            orderBy: { created_at: 'desc' }
          });

          const inventorySummary = {
            total_items: inventoryItems.length,
            available_items: inventoryItems.filter(item => item.status === 'available').length,
            low_stock_items: inventoryItems.filter(item => item.status === 'low_stock').length,
            out_of_stock_items: inventoryItems.filter(item => item.status === 'out_of_stock').length,
            total_quantity: inventoryItems.reduce((sum, item) => sum + item.total_quantity, 0),
            assigned_quantity: inventoryItems.reduce((sum, item) => sum + item.inventory_assignments.length, 0),
            available_quantity: inventoryItems.reduce((sum, item) => sum + Math.max(0, item.available_quantity), 0)
          };

          exportData = {
            summary: inventorySummary,
            inventory: inventoryItems,
            generated_at: new Date().toISOString()
          };
          break;

        case 'projects':
          // Get project reports data
          const { category: projCategory, status: projStatus, team_id, start_date: projStart, end_date: projEnd } = req.query;

          const where: any = {};
          if (projCategory) where.category = projCategory as any;
          if (projStatus) where.status = projStatus as any;
          if (team_id) where.team_id = team_id as string;

          const projects = await prisma.project.findMany({
            where,
            include: {
              team: {
                select: {
                  id: true,
                  team_name: true,
                  company_name: true,
                  status: true
                }
              },
              project_files: {
                select: {
                  id: true,
                  file_name: true,
                  file_type: true,
                  file_size: true,
                  uploaded_at: true
                },
                orderBy: { uploaded_at: 'desc' }
              }
            },
            orderBy: { created_at: 'desc' }
          });

          const projectSummary = {
            total_projects: projects.length,
            active_projects: projects.filter(p => p.status === 'active').length,
            pending_projects: projects.filter(p => p.status === 'pending').length,
            completed_projects: projects.filter(p => p.status === 'completed').length,
            on_hold_projects: projects.filter(p => p.status === 'on_hold').length,
            average_progress: projects.length > 0 ?
              (projects.reduce((sum, p) => sum + p.progress, 0) / projects.length).toFixed(1) : '0',
            total_files: projects.reduce((sum, p) => sum + p.project_files.length, 0)
          };

          exportData = {
            summary: projectSummary,
            projects,
            generated_at: new Date().toISOString()
          };
          break;

        default:
          res.status(400).json({
            success: false,
            message: 'Invalid report type. Must be teams, inventory, or projects'
          } as ReportsResponse);
          return;
      }

      // Return the export data
      console.log('Export data prepared:', exportData);
      res.json({
        success: true,
        message: `${report_type} report exported successfully`,
        data: exportData
      } as ReportsResponse);

    } catch (error) {
      console.error('Export report error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : String(error));
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      } as ReportsResponse);
    }
  }

  /**
   * Helper method to get director analytics
   */
  private static async getDirectorAnalytics() {
    const [
      activeTeams,
      projectCategories,
      inventoryStatus,
      recentActivity
    ] = await Promise.all([
      // Active teams count
      prisma.team.count({ where: { status: 'active' } }),

      // Project categories distribution
      prisma.project.groupBy({
        by: ['category'],
        _count: { category: true }
      }),

      // Inventory status distribution
      prisma.inventoryItem.groupBy({
        by: ['status'],
        _count: { status: true }
      }),

      // Recent activity (last 30 days)
      prisma.project.findMany({
        where: {
          created_at: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        select: {
          id: true,
          name: true,
          category: true,
          created_at: true,
          team: {
            select: {
              team_name: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 10
      })
    ]);

    return {
      active_teams: activeTeams,
      project_categories: projectCategories.map(cat => ({
        category: cat.category,
        count: cat._count.category
      })),
      inventory_status: inventoryStatus.map(status => ({
        status: status.status,
        count: status._count.status
      })),
      recent_activity: recentActivity
    };
  }

  /**
   * Helper method to get manager analytics
   */
  private static async getManagerAnalytics() {
    const [
      managedTeams,
      pendingRequests,
      inventoryAlerts,
      projectProgress
    ] = await Promise.all([
      // Teams count (managers see all teams)
      prisma.team.count(),

      // Pending material requests
      prisma.materialRequest.count({ where: { status: 'pending' } }),

      // Low stock inventory items
      prisma.inventoryItem.count({
        where: {
          OR: [
            { status: 'low_stock' },
            { status: 'out_of_stock' }
          ]
        }
      }),

      // Project progress summary
      prisma.project.findMany({
        select: {
          status: true,
          progress: true
        }
      })
    ]);

    const progressStats = projectProgress.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {} as any);

    return {
      managed_teams: managedTeams,
      pending_requests: pendingRequests,
      inventory_alerts: inventoryAlerts,
      project_progress: progressStats
    };
  }

  /**
   * Helper method to get mentor analytics
   */
  private static async getMentorAnalytics(mentorId: string) {
    const [
      assignedTeams,
      teamProjects,
      recentMessages
    ] = await Promise.all([
      // Teams assigned to this mentor
      prisma.mentorAssignment.count({
        where: { mentor_id: mentorId }
      }),

      // Projects from assigned teams
      prisma.mentorAssignment.findMany({
        where: { mentor_id: mentorId },
        include: {
          team: {
            include: {
              projects: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  progress: true
                }
              }
            }
          }
        }
      }),

      // Recent messages in conversations with assigned teams
      prisma.message.count({
        where: {
          sender_id: mentorId,
          sent_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    const projects = teamProjects.flatMap(assignment =>
      assignment.team.projects.map(project => ({
        ...project,
        team_name: assignment.team.team_name
      }))
    );

    return {
      assigned_teams: assignedTeams,
      team_projects: projects,
      recent_messages: recentMessages
    };
  }

  /**
   * Helper method to get incubator analytics
   */
  private static async getIncubatorAnalytics(userId: string) {
    const [
      myTeam,
      myProjects,
      myRequests,
      teamInventory
    ] = await Promise.all([
      // User's team
      prisma.teamMember.findFirst({
        where: { user_id: userId },
        include: {
          team: {
            include: {
              _count: {
                select: {
                  team_members: true,
                  projects: true
                }
              }
            }
          }
        }
      }),

      // User's projects
      prisma.project.count({
        where: {
          team: {
            team_members: {
              some: { user_id: userId }
            }
          }
        }
      }),

      // User's material requests
      prisma.materialRequest.count({
        where: {
          team: {
            team_members: {
              some: { user_id: userId }
            }
          }
        }
      }),

      // Team's inventory assignments
      prisma.inventoryAssignment.count({
        where: {
          team: {
            team_members: {
              some: { user_id: userId }
            }
          },
          returned_at: null
        }
      })
    ]);

    return {
      team_info: myTeam ? {
        team_name: myTeam.team.team_name,
        member_count: myTeam.team._count.team_members,
        project_count: myTeam.team._count.projects
      } : null,
      my_projects: myProjects,
      my_requests: myRequests,
      team_inventory: teamInventory
    };
  }
}