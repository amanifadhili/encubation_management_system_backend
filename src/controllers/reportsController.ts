import { Request, Response } from 'express';
import prisma from '../config/database';

// Advanced filtering and analytics types
interface AdvancedFilterOptions {
  date_from?: string;
  date_to?: string;
  status?: string;
  category?: string;
  team_id?: string;
  user_role?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface TimeSeriesOptions {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  metric: string;
  start_date?: string;
  end_date?: string;
}

interface AnalyticsResult {
  summary: any;
  details: any;
  time_series?: any[];
  predictions?: any[];
  comparisons?: any[];
}

interface ReportsResponse {
  success: boolean;
  message: string;
  data?: any;
}

export class ReportsController {
  /**
   * Advanced filtering system for all report types
   */
  private static buildWhereClause(filters: AdvancedFilterOptions): any {
    const where: any = {};

    // Date range filtering
    if (filters.date_from || filters.date_to) {
      where.created_at = {};
      if (filters.date_from) {
        where.created_at.gte = new Date(filters.date_from);
      }
      if (filters.date_to) {
        where.created_at.lte = new Date(filters.date_to);
      }
    }

    // Status filtering
    if (filters.status) {
      where.status = filters.status;
    }

    // Category filtering (for projects)
    if (filters.category) {
      where.category = filters.category;
    }

    // Team filtering
    if (filters.team_id) {
      where.team_id = filters.team_id;
    }

    return where;
  }

  /**
   * Execute report query based on type
   */
  private static async executeReportQuery(
    reportType: string,
    whereClause: any,
    options: AdvancedFilterOptions
  ): Promise<any> {
    const { sort_by = 'created_at', sort_order = 'desc', page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    switch (reportType) {
      case 'teams':
        return await ReportsController.getAdvancedTeamReports(whereClause, { sort_by, sort_order, skip, take: limit });

      case 'projects':
        return await ReportsController.getAdvancedProjectReports(whereClause, { sort_by, sort_order, skip, take: limit });

      case 'inventory':
        return await ReportsController.getAdvancedInventoryReports(whereClause, { sort_by, sort_order, skip, take: limit });

      case 'users':
        return await ReportsController.getAdvancedUserReports(whereClause, { sort_by, sort_order, skip, take: limit });

      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  /**
   * Advanced team reports with filtering and pagination
   */
  private static async getAdvancedTeamReports(whereClause: any, options: any): Promise<any> {
    const teams = await prisma.team.findMany({
      where: whereClause,
      include: {
        team_members: { select: { id: true } },
        projects: { select: { id: true, status: true } },
        mentor_assignments: { select: { id: true } },
        inventory_assignments: { where: { returned_at: null }, select: { id: true } },
        material_requests: { select: { id: true, status: true } }
      },
      orderBy: { [options.sort_by]: options.sort_order },
      skip: options.skip,
      take: options.take
    });

    const teamsWithMetrics = teams.map(team => ({
      id: team.id,
      team_name: team.team_name,
      company_name: team.company_name,
      status: team.status,
      created_at: team.created_at,
      metrics: {
        member_count: team.team_members.length,
        project_count: team.team_members.length,
        active_projects: team.projects.filter(p => p.status === 'active').length,
        completed_projects: team.projects.filter(p => p.status === 'completed').length,
        mentor_count: team.mentor_assignments.length,
        inventory_assigned: team.inventory_assignments.length,
        pending_requests: team.material_requests.filter(r => r.status === 'draft' || r.status === 'submitted' || r.status === 'pending_review').length,
        approved_requests: team.material_requests.filter(r => r.status === 'approved').length
      }
    }));

    return {
      teams: teamsWithMetrics,
      total: await prisma.team.count({ where: whereClause })
    };
  }

  /**
   * Advanced project reports with filtering and pagination
   */
  private static async getAdvancedProjectReports(whereClause: any, options: any): Promise<any> {
    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        team: { select: { team_name: true, company_name: true } },
        project_files: { select: { id: true, file_size: true } }
      },
      orderBy: { [options.sort_by]: options.sort_order },
      skip: options.skip,
      take: options.take
    });

    const projectsWithMetrics = projects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      category: project.category,
      status: project.status,
      progress: project.progress,
      team: project.team,
      created_at: project.created_at,
      metrics: {
        file_count: project.project_files.length,
        total_file_size: project.project_files.reduce((sum, file) => sum + (file.file_size || 0), 0),
        days_since_creation: Math.floor((Date.now() - project.created_at.getTime()) / (1000 * 60 * 60 * 24))
      }
    }));

    return {
      projects: projectsWithMetrics,
      total: await prisma.project.count({ where: whereClause })
    };
  }

  /**
   * Advanced inventory reports with filtering and pagination
   */
  private static async getAdvancedInventoryReports(whereClause: any, options: any): Promise<any> {
    const inventory = await prisma.inventoryItem.findMany({
      where: whereClause,
      include: {
        inventory_assignments: {
          where: { returned_at: null },
          include: { team: { select: { team_name: true } } }
        }
      },
      orderBy: { [options.sort_by]: options.sort_order },
      skip: options.skip,
      take: options.take
    });

    const inventoryWithMetrics = inventory.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      total_quantity: item.total_quantity,
      available_quantity: item.available_quantity,
      status: item.status,
      created_at: item.created_at,
      metrics: {
        assigned_quantity: item.inventory_assignments.length,
        utilization_rate: item.total_quantity > 0 ?
          ((item.inventory_assignments.length / item.total_quantity) * 100).toFixed(1) : '0',
        assigned_teams: [...new Set(item.inventory_assignments.map(a => a.team.team_name))],
        days_since_creation: Math.floor((Date.now() - item.created_at.getTime()) / (1000 * 60 * 60 * 24))
      }
    }));

    return {
      inventory: inventoryWithMetrics,
      total: await prisma.inventoryItem.count({ where: whereClause })
    };
  }

  /**
   * Advanced user reports with filtering and pagination
   */
  private static async getAdvancedUserReports(whereClause: any, options: any): Promise<any> {
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        team_members: { select: { team: { select: { team_name: true } } } },
        projects_uploaded: { select: { id: true } },
        announcements_created: { select: { id: true } },
        notifications_sent: { select: { id: true } },
        messages_sent: { select: { id: true } }
      },
      orderBy: { [options.sort_by]: options.sort_order },
      skip: options.skip,
      take: options.take
    });

    const usersWithMetrics = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      metrics: {
        teams_count: user.team_members.length,
        team_names: user.team_members.map(tm => tm.team.team_name),
        files_uploaded: user.projects_uploaded.length,
        announcements_created: user.announcements_created.length,
        notifications_sent: user.notifications_sent.length,
        messages_sent: user.messages_sent.length,
        days_since_join: Math.floor((Date.now() - user.created_at.getTime()) / (1000 * 60 * 60 * 24))
      }
    }));

    return {
      users: usersWithMetrics,
      total: await prisma.user.count({ where: whereClause })
    };
  }

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
   * Advanced reports endpoint with comprehensive filtering
   */
  static async getAdvancedReports(req: Request, res: Response): Promise<void> {
    try {
      const {
        report_type,
        date_from,
        date_to,
        status,
        category,
        team_id,
        user_role,
        sort_by = 'created_at',
        sort_order = 'desc',
        page = 1,
        limit = 50
      } = req.query;

      if (!report_type || typeof report_type !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Report type is required'
        } as ReportsResponse);
        return;
      }

      const filters: AdvancedFilterOptions = {
        date_from: date_from as string,
        date_to: date_to as string,
        status: status as string,
        category: category as string,
        team_id: team_id as string,
        user_role: user_role as string,
        sort_by: sort_by as string,
        sort_order: sort_order as 'asc' | 'desc',
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      };

      const whereClause = ReportsController.buildWhereClause(filters);
      const data = await ReportsController.executeReportQuery(report_type, whereClause, filters);

      const totalPages = Math.ceil(data.total / filters.limit!);

      res.json({
        success: true,
        message: `${report_type} advanced report retrieved successfully`,
        data: data,
        filters: filters,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: data.total,
          pages: totalPages
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Advanced reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      } as ReportsResponse);
    }
  }

  /**
   * Time-series analytics for trends and forecasting
   */
  static async getTimeSeriesAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const {
        period = 'monthly',
        metric,
        start_date,
        end_date
      }: TimeSeriesOptions = req.query as any;

      if (!metric) {
        res.status(400).json({
          success: false,
          message: 'Metric parameter is required'
        } as ReportsResponse);
        return;
      }

      const startDate = start_date ? new Date(start_date) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const endDate = end_date ? new Date(end_date) : new Date();

      const timeSeriesData = await ReportsController.generateTimeSeriesData(metric, period, startDate, endDate);

      res.json({
        success: true,
        message: `Time series data for ${metric} retrieved successfully`,
        data: {
          metric,
          period,
          date_range: { start: startDate, end: endDate },
          series: timeSeriesData
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Time series analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      } as ReportsResponse);
    }
  }

  /**
   * Generate time series data for various metrics
   */
  private static async generateTimeSeriesData(
    metric: string,
    period: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const series: any[] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      let nextDate: Date;
      let periodLabel: string;

      switch (period) {
        case 'daily':
          nextDate = new Date(currentDate);
          nextDate.setDate(currentDate.getDate() + 1);
          periodLabel = currentDate.toISOString().split('T')[0];
          break;
        case 'weekly':
          nextDate = new Date(currentDate);
          nextDate.setDate(currentDate.getDate() + 7);
          periodLabel = `Week of ${currentDate.toISOString().split('T')[0]}`;
          break;
        case 'monthly':
          nextDate = new Date(currentDate);
          nextDate.setMonth(currentDate.getMonth() + 1);
          periodLabel = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          break;
        case 'quarterly':
          nextDate = new Date(currentDate);
          nextDate.setMonth(currentDate.getMonth() + 3);
          const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
          periodLabel = `Q${quarter} ${currentDate.getFullYear()}`;
          break;
        default:
          nextDate = new Date(currentDate);
          nextDate.setMonth(currentDate.getMonth() + 1);
          periodLabel = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      }

      const count = await ReportsController.getMetricCountForPeriod(metric, currentDate, nextDate);

      series.push({
        period: periodLabel,
        date: currentDate.toISOString(),
        value: count,
        metric
      });

      currentDate = nextDate;
    }

    return series;
  }

  /**
   * Get metric count for a specific time period
   */
  private static async getMetricCountForPeriod(metric: string, startDate: Date, endDate: Date): Promise<number> {
    const whereClause = {
      created_at: {
        gte: startDate,
        lt: endDate
      }
    };

    switch (metric) {
      case 'users':
        return await prisma.user.count({ where: whereClause });
      case 'teams':
        return await prisma.team.count({ where: whereClause });
      case 'projects':
        return await prisma.project.count({ where: whereClause });
      case 'inventory_items':
        return await prisma.inventoryItem.count({ where: whereClause });
      case 'requests':
        return await prisma.materialRequest.count({
          where: {
            requested_at: {
              gte: startDate,
              lt: endDate
            }
          }
        });
      case 'announcements':
        return await prisma.announcement.count({ where: whereClause });
      case 'notifications':
        return await prisma.notification.count({ where: whereClause });
      case 'messages':
        return await prisma.message.count({
          where: {
            sent_at: {
              gte: startDate,
              lt: endDate
            }
          }
        });
      default:
        return 0;
    }
  }

  /**
    * Get cross-entity analytics and insights
    */
  static async getCrossEntityAnalytics(req: Request, res: Response): Promise<void> {
    try {

      const [
        // Teams with highest project success rates
        topPerformingTeams,
        // Users with most contributions
        mostActiveUsers,
        // Projects with highest file uploads
        projectsWithMostFiles,
        // Teams with most inventory usage
        teamsWithMostInventory,
        // Mentors with best success rates
        mentorPerformance,
        // Time correlation between activities
        activityCorrelations
      ] = await Promise.all([
        // Top performing teams by project completion
        ReportsController.getTopPerformingTeams(),
        // Most active users by various metrics
        ReportsController.getMostActiveUsers(),
        // Projects with most file uploads
        ReportsController.getProjectsWithMostFiles(),
        // Teams with highest inventory utilization
        ReportsController.getTeamsWithMostInventory(),
        // Mentor performance metrics
        ReportsController.getMentorPerformance(),
        // Activity correlations (simplified)
        ReportsController.getActivityCorrelations()
      ]);

      const analytics = {
        top_performing_teams: topPerformingTeams,
        most_active_users: mostActiveUsers,
        projects_with_most_files: projectsWithMostFiles,
        teams_with_most_inventory: teamsWithMostInventory,
        mentor_performance: mentorPerformance,
        activity_correlations: activityCorrelations,
        generated_at: new Date().toISOString(),
        data_freshness: 'real-time'
      };

      res.json({
        success: true,
        message: 'Cross-entity analytics retrieved successfully',
        data: analytics
      } as ReportsResponse);

    } catch (error) {
      console.error('Get cross-entity analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      } as ReportsResponse);
    }
  }

  /**
    * Get comprehensive system-wide metrics
    */
  static async getSystemMetrics(req: Request, res: Response): Promise<void> {
    try {

      const [
        // User metrics
        totalUsers,
        activeUsers,
        usersByRole,
        userGrowth,

        // Team metrics
        totalTeams,
        activeTeams,
        teamSuccessRate,
        teamAvgLifecycle,

        // Project metrics
        totalProjects,
        projectsByCategory,
        projectCompletionRate,
        avgProjectDuration,
        projectFilesCount,

        // Inventory metrics
        totalInventoryItems,
        inventoryUtilization,
        lowStockAlerts,
        inventoryTurnover,

        // Request metrics
        totalRequests,
        requestApprovalRate,
        avgRequestProcessingTime,
        requestsByTeam,

        // Communication metrics
        totalMessages,
        totalNotifications,
        totalAnnouncements,
        unreadNotifications,

        // Mentor metrics
        totalMentors,
        mentorAssignments,
        mentorUtilization
      ] = await Promise.all([
        // User metrics
        prisma.user.count(),
        prisma.user.count({
          where: {
            updated_at: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        }),
        prisma.user.groupBy({
          by: ['role'],
          _count: { role: true }
        }),
        prisma.user.findMany({
          where: {
            created_at: {
              gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
            }
          },
          select: { created_at: true },
          orderBy: { created_at: 'asc' }
        }),

        // Team metrics
        prisma.team.count(),
        prisma.team.count({ where: { status: 'active' } }),
        ReportsController.calculateTeamSuccessRate(),
        ReportsController.calculateTeamAvgLifecycle(),

        // Project metrics
        prisma.project.count(),
        prisma.project.groupBy({
          by: ['category'],
          _count: { category: true }
        }),
        ReportsController.calculateProjectCompletionRate(),
        ReportsController.calculateAvgProjectDuration(),
        prisma.projectFile.count(),

        // Inventory metrics
        prisma.inventoryItem.count(),
        ReportsController.calculateInventoryUtilization(),
        prisma.inventoryItem.count({
          where: {
            OR: [
              { status: 'low_stock' },
              { status: 'out_of_stock' }
            ]
          }
        }),
        ReportsController.calculateInventoryTurnover(),

        // Request metrics
        prisma.materialRequest.count(),
        ReportsController.calculateRequestApprovalRate(),
        ReportsController.calculateAvgRequestProcessingTime(),
        prisma.materialRequest.groupBy({
          by: ['team_id'],
          _count: { team_id: true }
        }),

        // Communication metrics
        prisma.message.count(),
        prisma.notification.count(),
        prisma.announcement.count(),
        0, // unreadNotifications - placeholder

        // Mentor metrics
        prisma.user.count({ where: { role: 'mentor' } }),
        prisma.mentorAssignment.count(),
        ReportsController.calculateMentorUtilization()
      ]);

      const metrics = {
        // User metrics
        total_users: totalUsers,
        active_users: activeUsers,
        users_by_role: usersByRole.map(role => ({
          role: role.role,
          count: role._count.role
        })),
        user_growth: ReportsController.processGrowthData(userGrowth, 'monthly'),

        // Team metrics
        total_teams: totalTeams,
        active_teams: activeTeams,
        team_success_rate: teamSuccessRate,
        team_avg_lifecycle: teamAvgLifecycle,

        // Project metrics
        total_projects: totalProjects,
        projects_by_category: projectsByCategory.map(cat => ({
          category: cat.category,
          count: cat._count.category
        })),
        project_completion_rate: projectCompletionRate,
        avg_project_duration: avgProjectDuration,
        project_files_count: projectFilesCount,

        // Inventory metrics
        total_inventory_items: totalInventoryItems,
        inventory_utilization: inventoryUtilization,
        low_stock_alerts: lowStockAlerts,
        inventory_turnover: inventoryTurnover,

        // Request metrics
        total_requests: totalRequests,
        request_approval_rate: requestApprovalRate,
        avg_request_processing_time: avgRequestProcessingTime,
        requests_by_team: requestsByTeam.map(req => ({
          team_id: req.team_id,
          count: req._count.team_id
        })),

        // Communication metrics
        total_messages: totalMessages,
        total_notifications: totalNotifications,
        total_announcements: totalAnnouncements,
        unread_notifications: unreadNotifications,

        // Mentor metrics
        total_mentors: totalMentors,
        mentor_assignments: mentorAssignments,
        mentor_utilization: mentorUtilization,

        // Metadata
        generated_at: new Date().toISOString(),
        data_freshness: 'real-time'
      };

      res.json({
        success: true,
        message: 'Comprehensive system metrics retrieved successfully',
        data: metrics
      } as ReportsResponse);

    } catch (error) {
      console.error('Get system metrics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      } as ReportsResponse);
    }
  }

  static async getCompanyReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;
      const userId = req.user?.userId;

      if (!id) {
        res.status(400).json({ success: false, message: 'Company/team id is required' } as ReportsResponse);
        return;
      }

      const team = await prisma.team.findUnique({
        where: { id },
        include: {
          team_members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  program_of_study: true,
                  graduation_year: true,
                  profile_photo_url: true
                }
              }
            }
          },
          mentor_assignments: {
            include: {
              mentor: {
                select: {
                  user: {
                    select: {
                      name: true,
                      email: true,
                      phone: true,
                      profile_photo_url: true
                    }
                  },
                  phone: true,
                  id: true,
                }
              }
            }
          },
          projects: {
            orderBy: { created_at: 'desc' },
            include: {
              project_files: true,
            }
          }
        }
      });

      if (!team) {
        res.status(404).json({ success: false, message: 'Company not found' } as ReportsResponse);
        return;
      }

      // Scope check for mentor/incubator
      if (userRole === 'incubator') {
        const allowed = await prisma.teamMember.findFirst({
          where: {
            team_id: id,
            user_id: userId
          }
        });
        if (!allowed) {
          res.status(403).json({ success: false, message: 'Forbidden' } as ReportsResponse);
          return;
        }
      } else if (userRole === 'mentor') {
        const allowed = await prisma.mentorAssignment.findFirst({
          where: {
            team_id: id,
            mentor: { user_id: userId }
          }
        });
        if (!allowed) {
          res.status(403).json({ success: false, message: 'Forbidden' } as ReportsResponse);
          return;
        }
      }

      const leaderMember = team.team_members.find((m) => m.role === 'team_leader');
      const mentorAssign = team.mentor_assignments?.[0];
      const mentorUser = mentorAssign?.mentor?.user;

      const payload = {
        id: team.id,
        company_name: team.company_name,
        team_name: team.team_name,
        status: team.status,
        rdb_registration_status: team.rdb_registration_status,
        enrollment_date: team.enrollment_date,
        created_at: team.created_at,
        updated_at: team.updated_at,
        mentor: mentorAssign
          ? {
              name: mentorUser?.name,
              email: mentorUser?.email,
              phone: mentorUser?.phone,
              assigned_at: mentorAssign.assigned_at,
            }
          : null,
        leader: leaderMember
          ? {
              name: leaderMember.user.name,
              email: leaderMember.user.email,
              phone: leaderMember.user.phone,
            }
          : null,
        members: team.team_members.map((m) => ({
          id: m.id,
          role: m.role,
          joined_at: m.joined_at,
          name: m.user.name,
          email: m.user.email,
          phone: m.user.phone,
          department: m.user.program_of_study,
          graduation_year: m.user.graduation_year,
          photo: m.user.profile_photo_url
        })),
        projects: team.projects.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          status: p.status,
          status_at_enrollment: p.status_at_enrollment,
          progress: p.progress,
          created_at: p.created_at,
          updated_at: p.updated_at,
          files: p.project_files.map((f) => ({
            id: f.id,
            name: f.file_name,
            path: f.file_path,
            type: f.file_type,
            size: f.file_size,
            uploaded_at: f.uploaded_at
          }))
        }))
      };

      res.json({
        success: true,
        message: 'Company report retrieved successfully',
        data: payload
      } as ReportsResponse);
    } catch (error) {
      console.error('Company report error:', error);
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
   * General report (combined projects/teams/mentors) with CSV/JSON output
   */
  static async getGeneralReport(req: Request, res: Response): Promise<void> {
    try {
      const {
        export: exportType,
        status,
        category,
        team_id,
        mentor_id,
        date_from,
        date_to,
        progress_min,
        progress_max,
        team_status,
        enrollment_from,
        enrollment_to,
        rdb_registration_status,
      } = req.query;

      // Role-based scope
      const userRole = req.user?.role;
      const userId = req.user?.userId;

      // Build filters
      const projectWhere: any = {};
      const teamWhere: any = {};

      if (status) projectWhere.status = status as any;
      if (category) projectWhere.category = category as any;
      if (date_from || date_to) {
        projectWhere.created_at = {};
        if (date_from) projectWhere.created_at.gte = new Date(date_from as string);
        if (date_to) projectWhere.created_at.lte = new Date(date_to as string);
      }
      const hasProgressMin = progress_min !== undefined && progress_min !== '';
      const hasProgressMax = progress_max !== undefined && progress_max !== '';

      // Only apply progress filters when a real value is provided (avoid treating empty strings as 0)
      if (hasProgressMin || hasProgressMax) {
        projectWhere.progress = {};
        if (hasProgressMin) projectWhere.progress.gte = Number(progress_min);
        if (hasProgressMax) projectWhere.progress.lte = Number(progress_max);
      }

      if (team_status) teamWhere.status = team_status as any;
      if (rdb_registration_status) teamWhere.rdb_registration_status = rdb_registration_status as string;
      if (team_id) teamWhere.id = team_id as string;
      if (enrollment_from || enrollment_to) {
        teamWhere.enrollment_date = {};
        if (enrollment_from) teamWhere.enrollment_date.gte = new Date(enrollment_from as string);
        if (enrollment_to) teamWhere.enrollment_date.lte = new Date(enrollment_to as string);
      }

      // Restrict scope for incubator/mentor based on teams
      if (userRole === 'incubator') {
        teamWhere.team_members = {
          some: { user_id: userId }
        };
      } else if (userRole === 'mentor') {
        teamWhere.mentor_assignments = {
          some: {
            mentor: {
              user_id: userId
            }
          }
        };
      }

      if (mentor_id) {
        teamWhere.mentor_assignments = {
          some: {
            mentor_id: mentor_id as string
          }
        };
      }

      const teams = await prisma.team.findMany({
        where: teamWhere,
        orderBy: { created_at: 'desc' },
        include: {
          team_members: {
            where: { role: 'team_leader' },
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                  current_role: true,
                  support_interests: true,
                  program_of_study: true,
                  graduation_year: true,
                }
              }
            }
          },
          mentor_assignments: {
            select: {
              assigned_at: true,
              mentor: {
                select: {
                  user: {
                    select: {
                      name: true,
                      email: true,
                      phone: true,
                    }
                  },
                  phone: true,
                  id: true,
                }
              }
            }
          },
          projects: {
            where: projectWhere,
            select: {
              id: true,
              name: true,
              category: true,
              challenge_description: true,
              status_at_enrollment: true,
              status: true,
              progress: true,
              created_at: true,
              updated_at: true,
            },
            orderBy: { created_at: 'desc' }
          }
        }
      });

      const rows: any[] = [];
      let snCounter = 1;

      teams.forEach((team) => {
        const leader = team.team_members?.[0]?.user;
        const mentorAssign = team.mentor_assignments?.[0];
        const mentorUser = mentorAssign?.mentor?.user;

        const projectsSummary =
          team.projects && team.projects.length > 0
            ? team.projects
                .map((p) => {
                  const detail = [
                    `Field: ${p.category || '-'}`,
                    `Status: ${p.status || '-'}`,
                    p.status_at_enrollment ? `Enroll: ${p.status_at_enrollment}` : null,
                    p.progress != null ? `Progress: ${p.progress}%` : null,
                  ]
                    .filter(Boolean)
                    .join(' | ');
                  return `${p.name || '-'}${detail ? ` (${detail})` : ''}`;
                })
                .join(' ; ')
            : '-';

        if (team.projects && team.projects.length > 0) {
          team.projects.forEach((p) => {
            rows.push({
              sn: snCounter++,
              team_id: team.id,
              company_name: team.company_name || '',
              rdb_registration_status: team.rdb_registration_status || '',
              enrollment_date: team.enrollment_date ? team.enrollment_date.toISOString() : '',
              team_status: team.status || '',
              mentor_name: mentorUser?.name || '',
              mentor_contact: mentorUser?.email || mentorUser?.phone || '',
              mentor_assignment_date: mentorAssign?.assigned_at ? mentorAssign.assigned_at.toISOString() : '',
              innovator_name: leader?.name || '',
              innovator_email: leader?.email || '',
              innovator_phone: leader?.phone || '',
              innovator_current_role: leader?.current_role || '',
              innovator_support_interests: Array.isArray(leader?.support_interests)
                ? (leader?.support_interests as unknown as string[]).join(' | ')
                : leader?.support_interests || '',
              department: leader?.program_of_study || '',
              planned_graduation_date: leader?.graduation_year ? `${leader.graduation_year}` : '',
              project_title: p.name || '',
              project_field: p.category || '',
              project_challenge_description: p.challenge_description || '',
              status_at_enrollment: p.status_at_enrollment || '',
              current_status: p.status || '',
              progress: p.progress ?? null,
              project_created_at: p.created_at ? p.created_at.toISOString() : '',
              project_updated_at: p.updated_at ? p.updated_at.toISOString() : '',
            });
          });
        } else {
          rows.push({
            sn: snCounter++,
            team_id: team.id,
            company_name: team.company_name || '',
            rdb_registration_status: team.rdb_registration_status || '',
            enrollment_date: team.enrollment_date ? team.enrollment_date.toISOString() : '',
            team_status: team.status || '',
            mentor_name: mentorUser?.name || '',
            mentor_contact: mentorUser?.email || mentorUser?.phone || '',
            mentor_assignment_date: mentorAssign?.assigned_at ? mentorAssign.assigned_at.toISOString() : '',
            innovator_name: leader?.name || '',
            innovator_email: leader?.email || '',
            innovator_phone: leader?.phone || '',
              innovator_current_role: leader?.current_role || '',
              innovator_support_interests: Array.isArray(leader?.support_interests)
                ? (leader?.support_interests as unknown as string[]).join(' | ')
                : leader?.support_interests || '',
            department: leader?.program_of_study || '',
            planned_graduation_date: leader?.graduation_year ? `${leader.graduation_year}` : '',
            project_title: '-',
            project_field: '-',
              project_challenge_description: '',
            status_at_enrollment: '-',
            current_status: '-',
            progress: null,
            project_created_at: '',
            project_updated_at: '',
          });
        }
      });

      if (exportType === 'csv') {
        const header = Object.keys(rows[0] || {}).filter(
          (h) => h !== 'project_created_at' && h !== 'project_updated_at' && h !== 'team_id'
        );
        const csv = [
          header.join(','),
          ...rows.map(r => header.map(h => {
            const val = (r as any)[h];
            if (val === null || val === undefined) return '';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
          }).join(','))
        ].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="general_report.csv"');
        res.send(csv);
        return;
      }

      res.json({
        success: true,
        message: 'General report generated successfully',
        data: {
          rows,
          total: rows.length
        }
      } as ReportsResponse);
    } catch (error) {
      console.error('General report error:', error);
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
      const { report_type, filters = {} } = req.body;

      if (!report_type) {
        res.status(400).json({
          success: false,
          message: 'Report type is required'
        } as ReportsResponse);
        return;
      }

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
      prisma.materialRequest.count({ where: { status: { in: ['draft', 'submitted', 'pending_review'] } } }),

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
    * Calculate team success rate (teams with completed projects)
    */
  private static async calculateTeamSuccessRate(): Promise<number> {
    const teams = await prisma.team.findMany({
      include: {
        projects: { select: { status: true } }
      }
    });

    const successfulTeams = teams.filter(team =>
      team.projects.some(project => project.status === 'completed')
    ).length;

    return teams.length > 0 ? (successfulTeams / teams.length) * 100 : 0;
  }

  /**
    * Calculate average team lifecycle in days
    */
  private static async calculateTeamAvgLifecycle(): Promise<number> {
    const teams = await prisma.team.findMany({
      where: {
        status: 'inactive'
      },
      select: { created_at: true, updated_at: true }
    });

    if (teams.length === 0) return 0;

    const totalDays = teams.reduce((sum, team) => {
      const start = team.created_at.getTime();
      const end = team.updated_at?.getTime() || Date.now();
      return sum + Math.floor((end - start) / (1000 * 60 * 60 * 24));
    }, 0);

    return Math.floor(totalDays / teams.length);
  }

  /**
    * Calculate project completion rate
    */
  private static async calculateProjectCompletionRate(): Promise<number> {
    const projects = await prisma.project.findMany({
      select: { status: true }
    });

    if (projects.length === 0) return 0;

    const completed = projects.filter(p => p.status === 'completed').length;
    return (completed / projects.length) * 100;
  }

  /**
    * Calculate average project duration in days
    */
  private static async calculateAvgProjectDuration(): Promise<number> {
    const completedProjects = await prisma.project.findMany({
      where: { status: 'completed' },
      select: { created_at: true, updated_at: true }
    });

    if (completedProjects.length === 0) return 0;

    const totalDays = completedProjects.reduce((sum, project) => {
      const start = project.created_at.getTime();
      const end = project.updated_at?.getTime() || Date.now();
      return sum + Math.floor((end - start) / (1000 * 60 * 60 * 24));
    }, 0);

    return Math.floor(totalDays / completedProjects.length);
  }

  /**
    * Calculate inventory utilization rate
    */
  private static async calculateInventoryUtilization(): Promise<number> {
    const items = await prisma.inventoryItem.findMany({
      select: { total_quantity: true, available_quantity: true }
    });

    if (items.length === 0) return 0;

    const totalCapacity = items.reduce((sum, item) => sum + item.total_quantity, 0);
    const totalAvailable = items.reduce((sum, item) => sum + item.available_quantity, 0);
    const totalUsed = totalCapacity - totalAvailable;

    return totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;
  }

  /**
    * Calculate inventory turnover rate
    */
  private static async calculateInventoryTurnover(): Promise<number> {
    const assignments = await prisma.inventoryAssignment.findMany({
      where: {
        assigned_at: {
          gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
        }
      },
      select: { assigned_at: true }
    });

    const items = await prisma.inventoryItem.count();

    if (items === 0) return 0;

    return assignments.length / items;
  }

  /**
    * Calculate request approval rate
    */
  private static async calculateRequestApprovalRate(): Promise<number> {
    const requests = await prisma.materialRequest.findMany({
      select: { status: true }
    });

    if (requests.length === 0) return 0;

    const approved = requests.filter(r => r.status === 'approved').length;
    return (approved / requests.length) * 100;
  }

  /**
    * Calculate average request processing time in days
    */
  private static async calculateAvgRequestProcessingTime(): Promise<number> {
    const processedRequests = await prisma.materialRequest.findMany({
      where: {
        status: { in: ['approved', 'declined'] }
      },
      select: { requested_at: true, reviewed_at: true }
    });

    if (processedRequests.length === 0) return 0;

    const totalDays = processedRequests.reduce((sum, request) => {
      const start = request.requested_at.getTime();
      const end = request.reviewed_at?.getTime() || Date.now();
      return sum + Math.floor((end - start) / (1000 * 60 * 60 * 24));
    }, 0);

    return Math.floor(totalDays / processedRequests.length);
  }

  /**
    * Calculate mentor utilization rate
    */
  private static async calculateMentorUtilization(): Promise<number> {
    const mentors = await prisma.user.count({ where: { role: 'mentor' } });
    const assignments = await prisma.mentorAssignment.count();

    if (mentors === 0) return 0;

    return (assignments / mentors) * 100;
  }

  /**
    * Process growth data into time series format
    */
  private static processGrowthData(data: any[], period: string): any[] {
    const grouped: { [key: string]: number } = {};

    data.forEach(item => {
      const date = new Date(item.created_at);
      let key: string;

      switch (period) {
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'quarterly':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          key = `Q${quarter} ${date.getFullYear()}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      grouped[key] = (grouped[key] || 0) + 1;
    });

    return Object.entries(grouped).map(([period, count]) => ({
      period,
      count
    })).sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
    * Get top performing teams by project completion rate
    */
  private static async getTopPerformingTeams(): Promise<any[]> {
    const teams = await prisma.team.findMany({
      include: {
        projects: { select: { status: true } }
      }
    });

    return teams
      .map(team => {
        const totalProjects = team.projects.length;
        const completedProjects = team.projects.filter(p => p.status === 'completed').length;
        const completionRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

        return {
          team_id: team.id,
          team_name: team.team_name,
          total_projects: totalProjects,
          completed_projects: completedProjects,
          completion_rate: completionRate
        };
      })
      .sort((a, b) => b.completion_rate - a.completion_rate)
      .slice(0, 10); // Top 10
  }

  /**
    * Get most active users by various metrics
    */
  private static async getMostActiveUsers(): Promise<any[]> {
    const users = await prisma.user.findMany({
      include: {
        team_members: { select: { id: true } },
        projects_uploaded: { select: { id: true } },
        announcements_created: { select: { id: true } },
        notifications_sent: { select: { id: true } },
        messages_sent: { select: { id: true } }
      }
    });

    return users
      .map(user => ({
        user_id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        activity_score:
          user.team_members.length * 2 +
          user.projects_uploaded.length * 3 +
          user.announcements_created.length * 2 +
          user.notifications_sent.length +
          user.messages_sent.length,
        teams_count: user.team_members.length,
        files_uploaded: user.projects_uploaded.length,
        announcements_created: user.announcements_created.length,
        notifications_sent: user.notifications_sent.length,
        messages_sent: user.messages_sent.length
      }))
      .sort((a, b) => b.activity_score - a.activity_score)
      .slice(0, 10); // Top 10
  }

  /**
    * Get projects with most file uploads
    */
  private static async getProjectsWithMostFiles(): Promise<any[]> {
    const projects = await prisma.project.findMany({
      include: {
        team: { select: { team_name: true } },
        project_files: { select: { id: true, file_size: true } }
      }
    });

    return projects
      .map(project => ({
        project_id: project.id,
        project_name: project.name,
        team_name: project.team.team_name,
        file_count: project.project_files.length,
        total_file_size: project.project_files.reduce((sum, file) => sum + (file.file_size || 0), 0)
      }))
      .sort((a, b) => b.file_count - a.file_count)
      .slice(0, 10); // Top 10
  }

  /**
    * Get teams with most inventory usage
    */
  private static async getTeamsWithMostInventory(): Promise<any[]> {
    const teams = await prisma.team.findMany({
      include: {
        inventory_assignments: {
          where: { returned_at: null },
          select: { id: true, quantity: true }
        }
      }
    });

    return teams
      .map(team => ({
        team_id: team.id,
        team_name: team.team_name,
        total_assignments: team.inventory_assignments.length,
        total_quantity: team.inventory_assignments.reduce((sum, assignment) => sum + assignment.quantity, 0)
      }))
      .sort((a, b) => b.total_assignments - a.total_assignments)
      .slice(0, 10); // Top 10
  }

  /**
    * Get mentor performance metrics
    */
  private static async getMentorPerformance(): Promise<any[]> {
    // Simplified version - return basic mentor stats
    const mentors = await prisma.user.findMany({
      where: { role: 'mentor' },
      select: { id: true, name: true }
    });

    const mentorAssignments = await prisma.mentorAssignment.findMany({
      select: { mentor_id: true }
    });

    // Count assignments per mentor
    const assignmentCounts = mentorAssignments.reduce((acc: any, assignment) => {
      acc[assignment.mentor_id] = (acc[assignment.mentor_id] || 0) + 1;
      return acc;
    }, {});

    return mentors.map(mentor => ({
      mentor_id: mentor.id,
      mentor_name: mentor.name,
      assigned_teams: assignmentCounts[mentor.id] || 0,
      total_projects: 0, // Simplified - would need more complex query
      completed_projects: 0, // Simplified - would need more complex query
      success_rate: 0 // Simplified - would need more complex query
    })).sort((a: any, b: any) => b.assigned_teams - a.assigned_teams);
  }

  /**
    * Get activity correlations (simplified version)
    */
  private static async getActivityCorrelations(): Promise<any> {
    // Simplified correlation analysis
    const [
      teamsWithProjects,
      usersWithFiles,
      projectsWithFiles
    ] = await Promise.all([
      prisma.team.count({
        where: {
          projects: { some: {} }
        }
      }),
      prisma.user.count({
        where: {
          projects_uploaded: { some: {} }
        }
      }),
      prisma.project.count({
        where: {
          project_files: { some: {} }
        }
      })
    ]);

    return {
      teams_with_projects_percentage: teamsWithProjects,
      users_with_files_percentage: usersWithFiles,
      projects_with_files_percentage: projectsWithFiles,
      insights: [
        'Teams with projects tend to be more active',
        'Users who upload files are more engaged',
        'Projects with files have higher completion rates'
      ]
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

  /**
   * Get usage analytics: Most used items, utilization rates
   */
  static async getUsageAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10, period = 'all' } = req.query;
      const limitNum = parseInt(limit as string, 10);

      // Calculate date range based on period
      let startDate: Date | undefined;
      const endDate = new Date();

      if (period === 'week') {
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
      } else if (period === 'month') {
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
      } else if (period === 'year') {
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
      }

      // Build date filter
      const dateFilter = startDate ? {
        created_at: { gte: startDate, lte: endDate }
      } : {};

      // Get most used items (by assignment count)
      const mostAssignedItems = await prisma.inventoryItem.findMany({
        where: {
          inventory_assignments: startDate ? {
            some: {
              assigned_at: { gte: startDate, lte: endDate }
            }
          } : {
            some: {}
          }
        },
        include: {
          _count: startDate ? {
            select: {
              inventory_assignments: {
                where: {
                  assigned_at: { gte: startDate, lte: endDate }
                }
              }
            }
          } : {
            select: {
              inventory_assignments: true
            }
          }
        },
        orderBy: {
          inventory_assignments: {
            _count: 'desc'
          }
        },
        take: limitNum
      });

      // Get utilization rates (available quantity / total quantity)
      const allItems = await prisma.inventoryItem.findMany({
        include: {
          inventory_assignments: {
            where: {
              returned_at: null
            }
          },
          _count: {
            select: {
              inventory_assignments: true
            }
          }
        }
      });

      const utilizationData = allItems.map(item => {
        const assignedQty = item.inventory_assignments.reduce(
          (sum, a) => sum + a.quantity, 0
        );
        const utilizationRate = item.total_quantity > 0 
          ? (assignedQty / item.total_quantity) * 100 
          : 0;

        return {
          item_id: item.id,
          item_name: item.name,
          category: item.category,
          total_quantity: item.total_quantity,
          assigned_quantity: assignedQty,
          available_quantity: item.available_quantity,
          utilization_rate: Math.round(utilizationRate * 100) / 100
        };
      });

      // Sort by utilization rate
      utilizationData.sort((a, b) => b.utilization_rate - a.utilization_rate);

      res.json({
        success: true,
        message: 'Usage analytics retrieved successfully',
        data: {
          period,
          most_used_items: mostAssignedItems.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            assignment_count: item._count.inventory_assignments
          })),
          utilization_rates: utilizationData.slice(0, limitNum),
          summary: {
            total_items: allItems.length,
            items_in_use: allItems.filter(item => 
              item.inventory_assignments.length > 0
            ).length,
            avg_utilization_rate: utilizationData.length > 0
              ? Math.round(
                  (utilizationData.reduce((sum, item) => sum + item.utilization_rate, 0) / utilizationData.length) * 100
                ) / 100
              : 0
          }
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get usage analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get assignment trends: Assignment patterns over time
   */
  static async getAssignmentTrends(req: Request, res: Response): Promise<void> {
    try {
      const { period = 'month', item_id } = req.query;
      const periodStr = period as string;

      // Calculate date range
      let startDate: Date;
      let interval: 'day' | 'week' | 'month';
      const endDate = new Date();

      if (periodStr === 'week') {
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        interval = 'day';
      } else if (periodStr === 'month') {
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
        interval = 'day';
      } else if (periodStr === 'year') {
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        interval = 'month';
      } else {
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 3);
        interval = 'week';
      }

      // Build where clause
      const where: any = {
        assigned_at: {
          gte: startDate,
          lte: endDate
        }
      };

      if (item_id) {
        where.item_id = item_id as string;
      }

      // Get assignments
      const assignments = await prisma.inventoryAssignment.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              name: true,
              category: true
            }
          },
          team: {
            select: {
              id: true,
              team_name: true
            }
          }
        },
        orderBy: { assigned_at: 'asc' }
      });

      // Group by time period
      const trends: { [key: string]: any } = {};

      assignments.forEach(assignment => {
        const date = new Date(assignment.assigned_at);
        let key: string;

        if (interval === 'day') {
          key = date.toISOString().split('T')[0];
        } else if (interval === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!trends[key]) {
          trends[key] = {
            period: key,
            assignment_count: 0,
            total_quantity: 0,
            items: new Set(),
            teams: new Set()
          };
        }

        trends[key].assignment_count++;
        trends[key].total_quantity += assignment.quantity;
        trends[key].items.add(assignment.item_id);
        trends[key].teams.add(assignment.team_id);
      });

      // Convert to array and format
      const trendsArray = Object.keys(trends).sort().map(key => ({
        period: key,
        assignment_count: trends[key].assignment_count,
        total_quantity: trends[key].total_quantity,
        unique_items: trends[key].items.size,
        unique_teams: trends[key].teams.size
      }));

      res.json({
        success: true,
        message: 'Assignment trends retrieved successfully',
        data: {
          period: periodStr,
          interval,
          trends: trendsArray,
          summary: {
            total_assignments: assignments.length,
            total_quantity: assignments.reduce((sum, a) => sum + a.quantity, 0),
            unique_items: new Set(assignments.map(a => a.item_id)).size,
            unique_teams: new Set(assignments.map(a => a.team_id)).size
          }
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get assignment trends error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get low stock alerts
   */
  static async getLowStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { include_zero = 'false' } = req.query;
      const includeZero = include_zero === 'true';

      // Get items with min_stock_level set
      const itemsWithMinStock = await prisma.inventoryItem.findMany({
        where: {
          min_stock_level: {
            not: null
          }
        },
        include: {
          location: {
            select: {
              id: true,
              name: true,
              building: true,
              room: true
            }
          },
          supplier: {
            select: {
              id: true,
              name: true,
              contact_person: true,
              email: true,
              phone: true
            }
          },
          inventory_assignments: {
            where: {
              returned_at: null
            }
          }
        }
      });

      // Calculate which items are low/out of stock
      const lowStockItems = itemsWithMinStock
        .map(item => {
          const assignedQty = item.inventory_assignments.reduce(
            (sum, a) => sum + a.quantity, 0
          );
          const availableQty = item.total_quantity - assignedQty;
          const minStock = item.min_stock_level || 0;

          return {
            item: {
              id: item.id,
              name: item.name,
              category: item.category,
              sku: item.sku,
              barcode: item.barcode
            },
            current_stock: availableQty,
            min_stock_level: minStock,
            total_quantity: item.total_quantity,
            assigned_quantity: assignedQty,
            reorder_quantity: item.reorder_quantity,
            status: availableQty <= 0 ? 'out_of_stock' : 
                    availableQty < minStock ? 'low_stock' : 'ok',
            location: item.location,
            supplier: item.supplier,
            last_replenished: item.last_replenished
          };
        })
        .filter(item => {
          if (!includeZero && item.current_stock <= 0) return false;
          return item.status !== 'ok';
        })
        .sort((a, b) => {
          // Sort by status (out of stock first, then low stock), then by current stock
          if (a.status !== b.status) {
            return a.status === 'out_of_stock' ? -1 : 1;
          }
          return a.current_stock - b.current_stock;
        });

      res.json({
        success: true,
        message: 'Low stock alerts retrieved successfully',
        data: {
          alerts: lowStockItems,
          summary: {
            total_alerts: lowStockItems.length,
            out_of_stock: lowStockItems.filter(item => item.status === 'out_of_stock').length,
            low_stock: lowStockItems.filter(item => item.status === 'low_stock').length
          }
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get low stock alerts error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get utilization reports: Item usage efficiency
   */
  static async getUtilizationReports(req: Request, res: Response): Promise<void> {
    try {
      const { category, min_utilization, max_utilization } = req.query;

      // Get all items with assignments
      const where: any = {};

      if (category && category !== 'all') {
        where.category = category as string;
      }

      const items = await prisma.inventoryItem.findMany({
        where,
        include: {
          inventory_assignments: {
            where: {
              returned_at: null
            }
          },
          location: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              inventory_assignments: true
            }
          }
        }
      });

      // Calculate utilization for each item
      const utilizationData = items.map(item => {
        const assignedQty = item.inventory_assignments.reduce(
          (sum, a) => sum + a.quantity, 0
        );
        const utilizationRate = item.total_quantity > 0 
          ? (assignedQty / item.total_quantity) * 100 
          : 0;

        return {
          item: {
            id: item.id,
            name: item.name,
            category: item.category,
            item_type: item.item_type
          },
          location: item.location,
          total_quantity: item.total_quantity,
          assigned_quantity: assignedQty,
          available_quantity: item.available_quantity,
          utilization_rate: Math.round(utilizationRate * 100) / 100,
          assignment_count: item._count.inventory_assignments,
          status: item.status
        };
      });

      // Filter by utilization rate if specified
      let filteredData = utilizationData;
      if (min_utilization) {
        const minUtil = parseFloat(min_utilization as string);
        filteredData = filteredData.filter(item => item.utilization_rate >= minUtil);
      }
      if (max_utilization) {
        const maxUtil = parseFloat(max_utilization as string);
        filteredData = filteredData.filter(item => item.utilization_rate <= maxUtil);
      }

      // Sort by utilization rate (descending)
      filteredData.sort((a, b) => b.utilization_rate - a.utilization_rate);

      // Calculate summary statistics
      const avgUtilization = filteredData.length > 0
        ? Math.round(
            (filteredData.reduce((sum, item) => sum + item.utilization_rate, 0) / filteredData.length) * 100
          ) / 100
        : 0;

      res.json({
        success: true,
        message: 'Utilization reports retrieved successfully',
        data: {
          items: filteredData,
          summary: {
            total_items: filteredData.length,
            avg_utilization_rate: avgUtilization,
            high_utilization: filteredData.filter(item => item.utilization_rate >= 80).length,
            medium_utilization: filteredData.filter(item => item.utilization_rate >= 40 && item.utilization_rate < 80).length,
            low_utilization: filteredData.filter(item => item.utilization_rate < 40).length
          }
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get utilization reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get consumption reports: Track refreshments and consumables usage
   */
  static async getConsumptionReports(req: Request, res: Response): Promise<void> {
    try {
      const {
        item_id,
        team_id,
        start_date,
        end_date,
        consumption_type,
        period = 'all'
      } = req.query;

      // Build where clause
      const where: any = {};

      if (item_id) {
        where.item_id = item_id as string;
      }

      if (team_id) {
        where.team_id = team_id as string;
      }

      if (consumption_type) {
        where.consumption_type = consumption_type as string;
      }

      // Date range
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (start_date) {
        startDate = new Date(start_date as string);
      }

      if (end_date) {
        endDate = new Date(end_date as string);
      } else if (period !== 'all') {
        endDate = new Date();
        startDate = new Date();

        if (period === 'week') {
          startDate.setDate(endDate.getDate() - 7);
        } else if (period === 'month') {
          startDate.setMonth(endDate.getMonth() - 1);
        } else if (period === 'year') {
          startDate.setFullYear(endDate.getFullYear() - 1);
        }
      }

      if (startDate || endDate) {
        where.consumption_date = {};
        if (startDate) where.consumption_date.gte = startDate;
        if (endDate) where.consumption_date.lte = endDate;
      }

      // Get consumption logs
      const consumptionLogs = await prisma.consumptionLog.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              name: true,
              category: true,
              distribution_unit: true
            }
          },
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          },
          distributor: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { consumption_date: 'desc' }
      });

      // Aggregate by item
      const itemAggregation: { [key: string]: any } = {};

      consumptionLogs.forEach(log => {
        const itemId = log.item_id;
        if (!itemAggregation[itemId]) {
          itemAggregation[itemId] = {
            item: log.item,
            total_quantity: 0,
            total_logs: 0,
            teams: new Set(),
            consumption_types: new Set(),
            first_consumption: log.consumption_date,
            last_consumption: log.consumption_date
          };
        }

        itemAggregation[itemId].total_quantity += log.quantity;
        itemAggregation[itemId].total_logs++;
        if (log.team_id) itemAggregation[itemId].teams.add(log.team_id);
        if (log.consumption_type) itemAggregation[itemId].consumption_types.add(log.consumption_type);

        if (log.consumption_date < itemAggregation[itemId].first_consumption) {
          itemAggregation[itemId].first_consumption = log.consumption_date;
        }
        if (log.consumption_date > itemAggregation[itemId].last_consumption) {
          itemAggregation[itemId].last_consumption = log.consumption_date;
        }
      });

      // Convert to array
      const itemSummary = Object.values(itemAggregation).map((agg: any) => ({
        item: agg.item,
        total_quantity: agg.total_quantity,
        total_logs: agg.total_logs,
        unique_teams: agg.teams.size,
        consumption_types: Array.from(agg.consumption_types),
        first_consumption: agg.first_consumption,
        last_consumption: agg.last_consumption
      }));

      // Sort by total quantity (descending)
      itemSummary.sort((a, b) => b.total_quantity - a.total_quantity);

      res.json({
        success: true,
        message: 'Consumption reports retrieved successfully',
        data: {
          period,
          consumption_logs: consumptionLogs,
          item_summary: itemSummary,
          summary: {
            total_logs: consumptionLogs.length,
            total_quantity: consumptionLogs.reduce((sum, log) => sum + log.quantity, 0),
            unique_items: itemSummary.length,
            unique_teams: new Set(consumptionLogs.map(log => log.team_id).filter(Boolean)).size
          }
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get consumption reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get distribution reports: Who received what and when
   */
  static async getDistributionReports(req: Request, res: Response): Promise<void> {
    try {
      const {
        item_id,
        team_id,
        distributed_by,
        start_date,
        end_date,
        period = 'all'
      } = req.query;

      // Build where clause
      const where: any = {};

      if (item_id) {
        where.item_id = item_id as string;
      }

      if (team_id) {
        where.team_id = team_id as string;
      }

      if (distributed_by) {
        where.distributed_by = distributed_by as string;
      }

      // Date range
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (start_date) {
        startDate = new Date(start_date as string);
      }

      if (end_date) {
        endDate = new Date(end_date as string);
      } else if (period !== 'all') {
        endDate = new Date();
        startDate = new Date();

        if (period === 'week') {
          startDate.setDate(endDate.getDate() - 7);
        } else if (period === 'month') {
          startDate.setMonth(endDate.getMonth() - 1);
        } else if (period === 'year') {
          startDate.setFullYear(endDate.getFullYear() - 1);
        }
      }

      if (startDate || endDate) {
        where.consumption_date = {};
        if (startDate) where.consumption_date.gte = startDate;
        if (endDate) where.consumption_date.lte = endDate;
      }

      // Get distribution logs
      const distributions = await prisma.consumptionLog.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              name: true,
              category: true,
              distribution_unit: true
            }
          },
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          },
          distributor: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { consumption_date: 'desc' }
      });

      // Aggregate by team
      const teamAggregation: { [key: string]: any } = {};

      distributions.forEach(dist => {
        const teamId = dist.team_id || 'unknown';
        if (!teamAggregation[teamId]) {
          teamAggregation[teamId] = {
            team: dist.team,
            items: new Map(),
            total_quantity: 0,
            distribution_count: 0,
            distributors: new Set()
          };
        }

        const itemKey = dist.item_id;
        if (!teamAggregation[teamId].items.has(itemKey)) {
          teamAggregation[teamId].items.set(itemKey, {
            item: dist.item,
            quantity: 0,
            distributions: []
          });
        }

        teamAggregation[teamId].items.get(itemKey).quantity += dist.quantity;
        teamAggregation[teamId].items.get(itemKey).distributions.push({
          date: dist.consumption_date,
          quantity: dist.quantity,
          distributed_by: dist.distributor,
          distributed_to: dist.distributed_to,
          consumption_type: dist.consumption_type,
          notes: dist.notes
        });

        teamAggregation[teamId].total_quantity += dist.quantity;
        teamAggregation[teamId].distribution_count++;
        if (dist.distributed_by) teamAggregation[teamId].distributors.add(dist.distributed_by);
      });

      // Convert to array format
      const teamSummary = Object.entries(teamAggregation).map(([teamId, agg]: [string, any]) => ({
        team: agg.team,
        items: Array.from(agg.items.values()),
        total_quantity: agg.total_quantity,
        distribution_count: agg.distribution_count,
        unique_distributors: agg.distributors.size
      }));

      // Aggregate by distributor
      const distributorAggregation: { [key: string]: any } = {};

      distributions.forEach(dist => {
        const distributorId = dist.distributed_by;
        if (!distributorAggregation[distributorId]) {
          distributorAggregation[distributorId] = {
            distributor: dist.distributor,
            total_quantity: 0,
            distribution_count: 0,
            items: new Set(),
            teams: new Set()
          };
        }

        distributorAggregation[distributorId].total_quantity += dist.quantity;
        distributorAggregation[distributorId].distribution_count++;
        distributorAggregation[distributorId].items.add(dist.item_id);
        if (dist.team_id) distributorAggregation[distributorId].teams.add(dist.team_id);
      });

      const distributorSummary = Object.values(distributorAggregation).map((agg: any) => ({
        distributor: agg.distributor,
        total_quantity: agg.total_quantity,
        distribution_count: agg.distribution_count,
        unique_items: agg.items.size,
        unique_teams: agg.teams.size
      }));

      res.json({
        success: true,
        message: 'Distribution reports retrieved successfully',
        data: {
          period,
          distributions,
          team_summary: teamSummary,
          distributor_summary: distributorSummary,
          summary: {
            total_distributions: distributions.length,
            total_quantity: distributions.reduce((sum, d) => sum + d.quantity, 0),
            unique_teams: teamSummary.length,
            unique_items: new Set(distributions.map(d => d.item_id)).size,
            unique_distributors: distributorSummary.length
          }
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get distribution reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get replenishment forecasting: Predict when to reorder based on consumption patterns
   */
  static async getReplenishmentForecasting(req: Request, res: Response): Promise<void> {
    try {
      const { days_ahead = 30 } = req.query;
      const daysAhead = parseInt(days_ahead as string, 10);

      // Get items with min_stock_level and consumption data
      const items = await prisma.inventoryItem.findMany({
        where: {
          min_stock_level: {
            not: null
          },
          OR: [
            { category: 'Refreshments' },
            { category: 'Consumables' },
            { is_frequently_distributed: true }
          ]
        },
        include: {
          consumption_logs: {
            orderBy: { consumption_date: 'desc' },
            take: 100 // Last 100 consumption logs for analysis
          },
          location: {
            select: {
              id: true,
              name: true
            }
          },
          supplier: {
            select: {
              id: true,
              name: true,
              contact_person: true,
              email: true,
              phone: true
            }
          },
          inventory_assignments: {
            where: {
              returned_at: null
            }
          }
        }
      });

      const forecasting = [];

      for (const item of items) {
        const assignedQty = item.inventory_assignments.reduce(
          (sum, a) => sum + a.quantity, 0
        );
        const currentStock = item.total_quantity - assignedQty;
        const minStock = item.min_stock_level || 0;

        if (currentStock <= 0) continue; // Skip out of stock items (already handled by low stock alerts)

        // Calculate average daily consumption from recent logs
        let avgDailyConsumption = 0;
        if (item.consumption_logs.length > 0) {
          // Get date range of consumption logs
          const logs = item.consumption_logs;
          const oldestLog = logs[logs.length - 1];
          const newestLog = logs[0];
          const daysDiff = Math.max(
            1,
            Math.ceil(
              (newestLog.consumption_date.getTime() - oldestLog.consumption_date.getTime()) / (1000 * 60 * 60 * 24)
            )
          );

          const totalConsumed = logs.reduce((sum, log) => sum + log.quantity, 0);
          avgDailyConsumption = totalConsumed / daysDiff;
        } else if (item.typical_consumption_rate) {
          // Use typical consumption rate if available (assuming it's per week)
          avgDailyConsumption = item.typical_consumption_rate / 7;
        }

        // Calculate days until stock runs out
        let daysUntilReorder = null;
        if (avgDailyConsumption > 0) {
          const stockToReplenish = currentStock - minStock;
          daysUntilReorder = Math.floor(stockToReplenish / avgDailyConsumption);
        }

        // Determine recommendation
        let recommendation = 'monitor';
        let urgency = 'low';
        if (daysUntilReorder !== null) {
          if (daysUntilReorder <= 7) {
            recommendation = 'reorder_immediately';
            urgency = 'high';
          } else if (daysUntilReorder <= 14) {
            recommendation = 'reorder_soon';
            urgency = 'medium';
          } else if (daysUntilReorder <= daysAhead) {
            recommendation = 'plan_reorder';
            urgency = 'medium';
          }
        }

        // Calculate suggested reorder quantity
        const suggestedReorderQty = item.reorder_quantity || 
          (avgDailyConsumption > 0 
            ? Math.ceil(avgDailyConsumption * 30) // 30 days supply
            : minStock * 2);

        forecasting.push({
          item: {
            id: item.id,
            name: item.name,
            category: item.category,
            sku: item.sku,
            distribution_unit: item.distribution_unit
          },
          current_stock: currentStock,
          min_stock_level: minStock,
          avg_daily_consumption: Math.round(avgDailyConsumption * 100) / 100,
          days_until_reorder: daysUntilReorder,
          recommended_reorder_quantity: suggestedReorderQty,
          recommendation,
          urgency,
          location: item.location,
          supplier: item.supplier,
          last_replenished: item.last_replenished,
          consumption_history_count: item.consumption_logs.length
        });
      }

      // Sort by urgency and days until reorder
      forecasting.sort((a, b) => {
        const urgencyOrder = { high: 0, medium: 1, low: 2 };
        if (urgencyOrder[a.urgency as keyof typeof urgencyOrder] !== urgencyOrder[b.urgency as keyof typeof urgencyOrder]) {
          return urgencyOrder[a.urgency as keyof typeof urgencyOrder] - urgencyOrder[b.urgency as keyof typeof urgencyOrder];
        }
        if (a.days_until_reorder !== null && b.days_until_reorder !== null) {
          return a.days_until_reorder - b.days_until_reorder;
        }
        return 0;
      });

      res.json({
        success: true,
        message: 'Replenishment forecasting retrieved successfully',
        data: {
          days_ahead,
          forecasting,
          summary: {
            total_items: forecasting.length,
            need_immediate_reorder: forecasting.filter(f => f.urgency === 'high').length,
            need_reorder_soon: forecasting.filter(f => f.urgency === 'medium').length,
            monitor: forecasting.filter(f => f.urgency === 'low').length
          }
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get replenishment forecasting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get usage pattern analysis: Time-series consumption patterns
   */
  static async getUsagePatternAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const {
        item_id,
        team_id,
        period = 'month',
        interval = 'day'
      } = req.query;

      // Calculate date range
      let startDate: Date;
      const endDate = new Date();

      if (period === 'week') {
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
      } else if (period === 'month') {
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
      } else if (period === 'year') {
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
      } else {
        // Default to 3 months
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 3);
      }

      // Build where clause
      const where: any = {
        consumption_date: {
          gte: startDate,
          lte: endDate
        }
      };

      if (item_id) {
        where.item_id = item_id as string;
      }

      if (team_id) {
        where.team_id = team_id as string;
      }

      // Get consumption logs
      const consumptionLogs = await prisma.consumptionLog.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              name: true,
              category: true,
              distribution_unit: true
            }
          },
          team: {
            select: {
              id: true,
              team_name: true
            }
          }
        },
        orderBy: { consumption_date: 'asc' }
      });

      // Group by time interval
      const patterns: { [key: string]: any } = {};
      const intervalStr = interval as string;

      consumptionLogs.forEach(log => {
        const date = new Date(log.consumption_date);
        let key: string;

        if (intervalStr === 'day') {
          key = date.toISOString().split('T')[0];
        } else if (intervalStr === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `Week ${weekStart.toISOString().split('T')[0]}`;
        } else if (intervalStr === 'month') {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
          // Default to day
          key = date.toISOString().split('T')[0];
        }

        if (!patterns[key]) {
          patterns[key] = {
            period: key,
            total_quantity: 0,
            distribution_count: 0,
            items: new Map(),
            teams: new Set()
          };
        }

        patterns[key].total_quantity += log.quantity;
        patterns[key].distribution_count++;

        // Aggregate by item
        const itemKey = log.item_id;
        if (!patterns[key].items.has(itemKey)) {
          patterns[key].items.set(itemKey, {
            item: log.item,
            quantity: 0,
            count: 0
          });
        }
        const itemData = patterns[key].items.get(itemKey);
        itemData.quantity += log.quantity;
        itemData.count++;

        if (log.team_id) {
          patterns[key].teams.add(log.team_id);
        }
      });

      // Convert to array format
      const patternArray = Object.keys(patterns).sort().map(key => ({
        period: key,
        total_quantity: patterns[key].total_quantity,
        distribution_count: patterns[key].distribution_count,
        unique_items: patterns[key].items.size,
        unique_teams: patterns[key].teams.size,
        items: Array.from(patterns[key].items.values())
      }));

      // Calculate trends
      let trend = 'stable';
      if (patternArray.length >= 2) {
        const firstHalf = patternArray.slice(0, Math.floor(patternArray.length / 2));
        const secondHalf = patternArray.slice(Math.floor(patternArray.length / 2));

        const firstHalfAvg = firstHalf.reduce((sum, p) => sum + p.total_quantity, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, p) => sum + p.total_quantity, 0) / secondHalf.length;

        const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

        if (changePercent > 10) {
          trend = 'increasing';
        } else if (changePercent < -10) {
          trend = 'decreasing';
        }
      }

      // Calculate averages
      const avgDailyQuantity = patternArray.length > 0
        ? patternArray.reduce((sum, p) => sum + p.total_quantity, 0) / patternArray.length
        : 0;

      res.json({
        success: true,
        message: 'Usage pattern analysis retrieved successfully',
        data: {
          period,
          interval: intervalStr,
          patterns: patternArray,
          trends: {
            overall_trend: trend,
            avg_daily_quantity: Math.round(avgDailyQuantity * 100) / 100,
            total_quantity: patternArray.reduce((sum, p) => sum + p.total_quantity, 0),
            total_distributions: patternArray.reduce((sum, p) => sum + p.distribution_count, 0),
            peak_period: patternArray.reduce((max, p) => 
              p.total_quantity > (max?.total_quantity || 0) ? p : max
            , patternArray[0] || null)
          },
          summary: {
            total_periods: patternArray.length,
            unique_items: new Set(consumptionLogs.map(log => log.item_id)).size,
            unique_teams: new Set(consumptionLogs.map(log => log.team_id).filter(Boolean)).size
          }
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get usage pattern analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Auto-create replenishment requests for low stock items
   */
  static async autoCreateReplenishmentRequests(req: Request, res: Response): Promise<void> {
    try {
      // Only managers/directors can trigger this
      if (req.user?.role !== 'manager' && req.user?.role !== 'director') {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as ReportsResponse);
        return;
      }

      const { dry_run = 'false', team_id } = req.body;
      const isDryRun = dry_run === 'true';

      // Find items that need replenishment
      const itemsNeedingReplenishment = await prisma.inventoryItem.findMany({
        where: {
          min_stock_level: {
            not: null
          },
          OR: [
            { category: 'Refreshments' },
            { category: 'Consumables' },
            { is_frequently_distributed: true }
          ]
        },
        include: {
          location: {
            select: {
              id: true,
              name: true
            }
          },
          supplier: {
            select: {
              id: true,
              name: true
            }
          },
          inventory_assignments: {
            where: {
              returned_at: null
            }
          },
          consumption_logs: {
            orderBy: { consumption_date: 'desc' },
            take: 30 // Last 30 logs for consumption rate calculation
          }
        }
      });

      const replenishmentRequests = [];
      const errors = [];

      for (const item of itemsNeedingReplenishment) {
        try {
          const assignedQty = item.inventory_assignments.reduce(
            (sum, a) => sum + a.quantity, 0
          );
          const currentStock = item.total_quantity - assignedQty;
          const minStock = item.min_stock_level || 0;

          // Only create request if stock is below minimum
          if (currentStock >= minStock) continue;

          // Calculate suggested reorder quantity
          let suggestedQty = item.reorder_quantity || minStock * 2;

          // Calculate average daily consumption if we have logs
          if (item.consumption_logs.length > 0) {
            const logs = item.consumption_logs;
            const oldestLog = logs[logs.length - 1];
            const newestLog = logs[0];
            const daysDiff = Math.max(
              1,
              Math.ceil(
                (newestLog.consumption_date.getTime() - oldestLog.consumption_date.getTime()) / (1000 * 60 * 60 * 24)
              )
            );
            const totalConsumed = logs.reduce((sum, log) => sum + log.quantity, 0);
            const avgDailyConsumption = totalConsumed / daysDiff;
            
            // Order 30 days worth
            suggestedQty = Math.ceil(avgDailyConsumption * 30);
          }

          // Determine team - use provided team_id or find a default team
          let targetTeamId = team_id;
          if (!targetTeamId) {
            // Try to find a team that has requested this item before
            const previousRequest = await prisma.materialRequest.findFirst({
              where: {
                items: {
                  some: {
                    inventory_item_id: item.id
                  }
                }
              },
              orderBy: { requested_at: 'desc' }
            });
            
            if (previousRequest) {
              targetTeamId = previousRequest.team_id;
            } else {
              // Skip if no team found and no team_id provided
              errors.push({
                item_id: item.id,
                item_name: item.name,
                error: 'No team specified and no previous request found'
              });
              continue;
            }
          }

          // Check if team exists
          const team = await prisma.team.findUnique({
            where: { id: targetTeamId }
          });

          if (!team) {
            errors.push({
              item_id: item.id,
              item_name: item.name,
              error: 'Team not found'
            });
            continue;
          }

          if (!isDryRun) {
            // Create replenishment request
            // Generate request number manually
            const year = new Date().getFullYear();
            const prefix = `REQ-${year}-`;
            const lastRequest = await prisma.materialRequest.findFirst({
              where: {
                request_number: {
                  startsWith: prefix
                }
              },
              orderBy: {
                request_number: 'desc'
              }
            });
            let sequence = 1;
            if (lastRequest && lastRequest.request_number) {
              const lastSequence = parseInt(lastRequest.request_number.replace(prefix, ''), 10);
              if (!isNaN(lastSequence)) {
                sequence = lastSequence + 1;
              }
            }
            const sequenceStr = sequence.toString().padStart(4, '0');
            const requestNumber = `${prefix}${sequenceStr}`;

            const request = await prisma.materialRequest.create({
              data: {
                request_number: requestNumber,
                team_id: targetTeamId,
                title: `Replenishment Request: ${item.name}`,
                description: `Auto-generated replenishment request. Current stock: ${currentStock}, Minimum: ${minStock}`,
                priority: 'High',
                is_consumable_request: true,
                requires_quick_approval: true,
                requested_by: req.user!.userId,
                status: 'draft', // Create as draft so it can be reviewed
                delivery_status: 'not_ordered',
                items: {
                  create: {
                    inventory_item_id: item.id,
                    item_name: item.name,
                    quantity: suggestedQty,
                    unit: item.distribution_unit,
                    is_consumable: true,
                    status: 'pending'
                  }
                }
              },
              include: {
                team: {
                  select: {
                    id: true,
                    team_name: true
                  }
                },
                items: true
              }
            });

            replenishmentRequests.push({
              request_id: request.id,
              request_number: request.request_number,
              item_id: item.id,
              item_name: item.name,
              current_stock: currentStock,
              min_stock: minStock,
              suggested_quantity: suggestedQty,
              team_id: targetTeamId,
              team_name: team.team_name
            });
          } else {
            // Dry run - just add to list
            replenishmentRequests.push({
              item_id: item.id,
              item_name: item.name,
              current_stock: currentStock,
              min_stock: minStock,
              suggested_quantity: suggestedQty,
              team_id: targetTeamId,
              team_name: team.team_name,
              would_create: true
            });
          }
        } catch (itemError) {
          errors.push({
            item_id: item.id,
            item_name: item.name,
            error: itemError instanceof Error ? itemError.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: true,
        message: isDryRun 
          ? `Dry run: Would create ${replenishmentRequests.length} replenishment requests`
          : `Created ${replenishmentRequests.length} replenishment requests`,
        data: {
          is_dry_run: isDryRun,
          requests_created: replenishmentRequests.length,
          errors_count: errors.length,
          requests: replenishmentRequests,
          errors: errors.length > 0 ? errors : undefined
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Auto-create replenishment requests error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get request analytics: Request patterns, approval times, trends
   */
  static async getRequestAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const {
        period = 'month',
        team_id,
        priority,
        status
      } = req.query;

      // Calculate date range
      let startDate: Date;
      const endDate = new Date();

      if (period === 'week') {
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
      } else if (period === 'month') {
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
      } else if (period === 'year') {
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
      } else {
        // Default to 3 months
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 3);
      }

      // Build where clause
      const where: any = {
        requested_at: {
          gte: startDate,
          lte: endDate
        }
      };

      if (team_id) {
        where.team_id = team_id as string;
      }

      if (priority && priority !== 'all') {
        where.priority = priority as string;
      }

      if (status && status !== 'all') {
        where.status = status as string;
      }

      // Get all requests with approvals
      const requests = await prisma.materialRequest.findMany({
        where,
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          },
          requester: {
            select: {
              id: true,
              name: true
            }
          },
          approvals: {
            orderBy: { approval_level: 'asc' },
            include: {
              approver: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          items: {
            include: {
              inventory_item: {
                select: {
                  id: true,
                  name: true,
                  category: true
                }
              }
            }
          },
          _count: {
            select: {
              items: true,
              comments: true
            }
          }
        },
        orderBy: { requested_at: 'desc' }
      });

      // Calculate approval times
      const approvalTimes = requests
        .filter(req => req.approved_at && req.requested_at)
        .map(req => {
          const requested = new Date(req.requested_at).getTime();
          const approved = req.approved_at ? new Date(req.approved_at).getTime() : 0;
          return (approved - requested) / (1000 * 60 * 60 * 24); // Days
        });

      const avgApprovalTime = approvalTimes.length > 0
        ? approvalTimes.reduce((sum, time) => sum + time, 0) / approvalTimes.length
        : 0;

      // Group by status
      const statusBreakdown: { [key: string]: number } = {};
      requests.forEach(req => {
        statusBreakdown[req.status] = (statusBreakdown[req.status] || 0) + 1;
      });

      // Group by priority
      const priorityBreakdown: { [key: string]: number } = {};
      requests.forEach(req => {
        priorityBreakdown[req.priority] = (priorityBreakdown[req.priority] || 0) + 1;
      });

      // Group by team
      const teamBreakdown: { [key: string]: any } = {};
      requests.forEach(req => {
        const teamId = req.team_id;
        if (!teamBreakdown[teamId]) {
          teamBreakdown[teamId] = {
            team: req.team,
            request_count: 0,
            approved_count: 0,
            pending_count: 0,
            declined_count: 0
          };
        }
        teamBreakdown[teamId].request_count++;
        if (req.status === 'approved' || req.status === 'delivered' || req.status === 'completed') {
          teamBreakdown[teamId].approved_count++;
        } else if (req.status === 'draft' || req.status === 'pending_review' || req.status === 'submitted') {
          teamBreakdown[teamId].pending_count++;
        } else if (req.status === 'declined') {
          teamBreakdown[teamId].declined_count++;
        }
      });

      // Time-series analysis (requests over time)
      const timeSeries: { [key: string]: any } = {};
      requests.forEach(req => {
        const date = new Date(req.requested_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (!timeSeries[key]) {
          timeSeries[key] = {
            date: key,
            total: 0,
            approved: 0,
            pending: 0,
            declined: 0
          };
        }

        timeSeries[key].total++;
        if (req.status === 'approved' || req.status === 'delivered' || req.status === 'completed') {
          timeSeries[key].approved++;
        } else if (req.status === 'draft' || req.status === 'pending_review' || req.status === 'submitted') {
          timeSeries[key].pending++;
        } else if (req.status === 'declined') {
          timeSeries[key].declined++;
        }
      });

      const timeSeriesArray = Object.values(timeSeries).sort((a: any, b: any) => 
        a.date.localeCompare(b.date)
      );

      // Approval level analysis
      const approvalLevelStats: { [key: number]: any } = {};
      requests.forEach(req => {
        req.approvals.forEach(approval => {
          const level = approval.approval_level;
          if (!approvalLevelStats[level]) {
            approvalLevelStats[level] = {
              level,
              total: 0,
              approved: 0,
              declined: 0,
              pending: 0,
              avg_time: 0
            };
          }

          approvalLevelStats[level].total++;
          if (approval.status === 'approved') {
            approvalLevelStats[level].approved++;
          } else if (approval.status === 'declined') {
            approvalLevelStats[level].declined++;
          } else {
            approvalLevelStats[level].pending++;
          }

          // Calculate average approval time for this level
          if (approval.approved_at && req.requested_at) {
            const requested = new Date(req.requested_at).getTime();
            const approved = new Date(approval.approved_at).getTime();
            const timeDiff = (approved - requested) / (1000 * 60 * 60 * 24);
            approvalLevelStats[level].avg_time = 
              (approvalLevelStats[level].avg_time * (approvalLevelStats[level].approved - 1) + timeDiff) / 
              approvalLevelStats[level].approved;
          }
        });
      });

      // Most requested items
      const itemRequestCounts: { [key: string]: any } = {};
      requests.forEach(req => {
        req.items.forEach(item => {
          const itemId = item.inventory_item_id || item.item_name;
          if (!itemRequestCounts[itemId]) {
            itemRequestCounts[itemId] = {
              item_id: item.inventory_item_id,
              item_name: item.item_name,
              inventory_item: item.inventory_item,
              request_count: 0,
              total_quantity: 0
            };
          }
          itemRequestCounts[itemId].request_count++;
          itemRequestCounts[itemId].total_quantity += item.quantity;
        });
      });

      const mostRequestedItems = Object.values(itemRequestCounts)
        .sort((a: any, b: any) => b.request_count - a.request_count)
        .slice(0, 10);

      // Approval rate
      const approvalRate = requests.length > 0
        ? (requests.filter(r => r.status === 'approved' || r.status === 'delivered' || r.status === 'completed').length / requests.length) * 100
        : 0;

      res.json({
        success: true,
        message: 'Request analytics retrieved successfully',
        data: {
          period,
          summary: {
            total_requests: requests.length,
            approved_requests: requests.filter(r => r.status === 'approved' || r.status === 'delivered' || r.status === 'completed').length,
            pending_requests: requests.filter(r => r.status === 'draft' || r.status === 'pending_review' || r.status === 'submitted').length,
            declined_requests: requests.filter(r => r.status === 'declined').length,
            approval_rate: Math.round(approvalRate * 100) / 100,
            avg_approval_time_days: Math.round(avgApprovalTime * 100) / 100,
            min_approval_time_days: approvalTimes.length > 0 ? Math.round(Math.min(...approvalTimes) * 100) / 100 : 0,
            max_approval_time_days: approvalTimes.length > 0 ? Math.round(Math.max(...approvalTimes) * 100) / 100 : 0
          },
          status_breakdown: statusBreakdown,
          priority_breakdown: priorityBreakdown,
          team_breakdown: Object.values(teamBreakdown),
          time_series: timeSeriesArray,
          approval_level_stats: Object.values(approvalLevelStats),
          most_requested_items: mostRequestedItems
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get request analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }

  /**
   * Get comprehensive analytics combining inventory and request data
   */
  static async getComprehensiveUsageAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { period = 'month' } = req.query;

      // Calculate date range
      let startDate: Date;
      const endDate = new Date();

      if (period === 'week') {
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
      } else if (period === 'month') {
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
      } else if (period === 'year') {
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
      } else {
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 3);
      }

      // Get aggregated data
      const [
        totalItems,
        totalRequests,
        totalConsumptionLogs,
        avgUtilization,
        approvalRate
      ] = await Promise.all([
        // Total items
        prisma.inventoryItem.count(),
        
        // Total requests in period
        prisma.materialRequest.count({
          where: {
            requested_at: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        
        // Total consumption logs in period
        prisma.consumptionLog.count({
          where: {
            consumption_date: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        
        // Average utilization (calculated)
        (async () => {
          const items = await prisma.inventoryItem.findMany({
            include: {
              inventory_assignments: {
                where: { returned_at: null }
              }
            }
          });
          
          if (items.length === 0) return 0;
          
          const utilizationRates = items.map(item => {
            const assignedQty = item.inventory_assignments.reduce(
              (sum, a) => sum + a.quantity, 0
            );
            return item.total_quantity > 0 
              ? (assignedQty / item.total_quantity) * 100 
              : 0;
          });
          
          return utilizationRates.reduce((sum, rate) => sum + rate, 0) / utilizationRates.length;
        })(),
        
        // Approval rate
        (async () => {
          const requests = await prisma.materialRequest.findMany({
            where: {
              requested_at: {
                gte: startDate,
                lte: endDate
              }
            }
          });
          
          if (requests.length === 0) return 0;
          
          const approved = requests.filter(r => 
            r.status === 'approved' || r.status === 'delivered' || r.status === 'completed'
          ).length;
          
          return (approved / requests.length) * 100;
        })()
      ]);

      res.json({
        success: true,
        message: 'Comprehensive usage analytics retrieved successfully',
        data: {
          period,
          summary: {
            total_items: totalItems,
            total_requests: totalRequests,
            total_consumption_logs: totalConsumptionLogs,
            avg_utilization_rate: Math.round(avgUtilization * 100) / 100,
            request_approval_rate: Math.round(approvalRate * 100) / 100
          },
          note: 'For detailed analytics, use individual endpoints: /usage-analytics, /request-analytics, /consumption'
        }
      } as ReportsResponse);

    } catch (error) {
      console.error('Get comprehensive usage analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReportsResponse);
    }
  }
}