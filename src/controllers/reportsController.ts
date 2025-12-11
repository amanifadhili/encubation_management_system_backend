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
        pending_requests: team.material_requests.filter(r => r.status === 'pending').length,
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
      console.log('Advanced reports request:', req.query);

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

      console.log('Applying filters:', filters);

      const whereClause = ReportsController.buildWhereClause(filters);
      console.log('Generated where clause:', whereClause);

      const data = await ReportsController.executeReportQuery(report_type, whereClause, filters);
      console.log('Query result:', data);

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

      console.log('Time series request:', { period, metric, startDate, endDate });

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
      console.log('Getting cross-entity analytics...');

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
      console.log('Getting comprehensive system metrics...');

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
      if (progress_min !== undefined || progress_max !== undefined) {
        projectWhere.progress = {};
        if (progress_min !== undefined) projectWhere.progress.gte = Number(progress_min);
        if (progress_max !== undefined) projectWhere.progress.lte = Number(progress_max);
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

        rows.push({
          sn: snCounter++,
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
          department: leader?.program_of_study || '',
          planned_graduation_date: leader?.graduation_year ? `${leader.graduation_year}` : '',
          projects: projectsSummary,
        });
      });

      if (exportType === 'csv') {
        const header = Object.keys(rows[0] || {});
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
}