import { Request, Response } from 'express';
import prisma from '../config/database';
import { validateFile, generateFileMetadata, cleanupFile, getFileUrl } from '../middleware/upload';
import { FileService } from '../services/fileService';

interface UploadResponse {
  success: boolean;
  message: string;
  data?: any;
}

export class UploadController {
  /**
   * Handle single file upload
   */
  static async uploadSingleFile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        } as UploadResponse);
        return;
      }

      const file = req.file;
      const validation = validateFile(file);

      if (!validation.valid) {
        // Clean up the uploaded file
        await cleanupFile(file.path);
        res.status(400).json({
          success: false,
          message: validation.error
        } as UploadResponse);
        return;
      }

      const fileMetadata = generateFileMetadata(file);

      res.json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          file: fileMetadata
        }
      } as UploadResponse);

    } catch (error) {
      console.error('Upload single file error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }

  /**
   * Handle multiple file uploads
   */
  static async uploadMultipleFiles(req: Request, res: Response): Promise<void> {
    try {
      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        res.status(400).json({
          success: false,
          message: 'No files uploaded'
        } as UploadResponse);
        return;
      }

      const files = req.files as Express.Multer.File[];
      const uploadedFiles: any[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const validation = validateFile(file);

        if (validation.valid) {
          const fileMetadata = generateFileMetadata(file);
          uploadedFiles.push(fileMetadata);
        } else {
          // Clean up invalid files
          await cleanupFile(file.path);
          errors.push(`${file.originalname}: ${validation.error}`);
        }
      }

      if (uploadedFiles.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No valid files uploaded',
          data: { errors }
        } as UploadResponse);
        return;
      }

      res.json({
        success: true,
        message: `${uploadedFiles.length} file(s) uploaded successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
        data: {
          files: uploadedFiles,
          errors: errors.length > 0 ? errors : undefined
        }
      } as UploadResponse);

    } catch (error) {
      console.error('Upload multiple files error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }

  /**
   * Upload project files (linked to projects)
   */
  static async uploadProjectFiles(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        res.status(400).json({
          success: false,
          message: 'No files uploaded'
        } as UploadResponse);
        return;
      }

      // Verify project exists and user has access
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          team: {
            include: {
              team_members: {
                where: { user_id: req.user!.userId },
                select: { id: true }
              }
            }
          }
        }
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found'
        } as UploadResponse);
        return;
      }

      // Check if user has access to this project
      const hasAccess = req.user!.role === 'director' ||
                       req.user!.role === 'manager' ||
                       project.team.team_members.length > 0;

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to upload files to this project'
        } as UploadResponse);
        return;
      }

      const files = req.files as Express.Multer.File[];
      const uploadedFiles: any[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const validation = validateFile(file);

        if (validation.valid) {
          // Create project file record
          const projectFile = await prisma.projectFile.create({
            data: {
              project_id: projectId,
              file_name: file.originalname,
              file_path: getFileUrl(file),
              file_type: file.mimetype,
              file_size: file.size,
              uploaded_by: req.user!.userId
            }
          });

          uploadedFiles.push({
            id: projectFile.id,
            file_name: projectFile.file_name,
            file_path: projectFile.file_path,
            file_type: projectFile.file_type,
            file_size: projectFile.file_size,
            uploaded_at: projectFile.uploaded_at
          });
        } else {
          // Clean up invalid files
          await cleanupFile(file.path);
          errors.push(`${file.originalname}: ${validation.error}`);
        }
      }

      if (uploadedFiles.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No valid files uploaded',
          data: { errors }
        } as UploadResponse);
        return;
      }

      res.json({
        success: true,
        message: `${uploadedFiles.length} file(s) uploaded to project successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
        data: {
          project_id: projectId,
          files: uploadedFiles,
          errors: errors.length > 0 ? errors : undefined
        }
      } as UploadResponse);

    } catch (error) {
      console.error('Upload project files error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }

  /**
   * Upload message file (for chat)
   */
  static async uploadMessageFile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        } as UploadResponse);
        return;
      }

      const file = req.file;
      const validation = validateFile(file);

      if (!validation.valid) {
        // Clean up the uploaded file
        await cleanupFile(file.path);
        res.status(400).json({
          success: false,
          message: validation.error
        } as UploadResponse);
        return;
      }

      const fileMetadata = generateFileMetadata(file);

      res.json({
        success: true,
        message: 'Message file uploaded successfully',
        data: {
          file: fileMetadata
        }
      } as UploadResponse);

    } catch (error) {
      console.error('Upload message file error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }

  /**
   * Get file information
   */
  static async getFileInfo(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;

      const file = await prisma.projectFile.findUnique({
        where: { id: fileId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              team: {
                select: {
                  id: true,
                  team_name: true,
                  team_members: {
                    where: { user_id: req.user!.userId },
                    select: { id: true, user_id: true }
                  }
                }
              }
            }
          },
          uploader: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!file) {
        res.status(404).json({
          success: false,
          message: 'File not found'
        } as UploadResponse);
        return;
      }

      // Check if user has access to this file
      const hasAccess = req.user!.role === 'director' ||
                       req.user!.role === 'manager' ||
                       file.project.team.team_members?.some(member => member.user_id === req.user!.userId);

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to access this file'
        } as UploadResponse);
        return;
      }

      res.json({
        success: true,
        message: 'File information retrieved successfully',
        data: {
          file: {
            id: file.id,
            file_name: file.file_name,
            file_path: file.file_path,
            file_type: file.file_type,
            file_size: file.file_size,
            uploaded_at: file.uploaded_at,
            project: file.project,
            uploaded_by: file.uploader
          }
        }
      } as UploadResponse);

    } catch (error) {
      console.error('Get file info error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }

  /**
   * Delete file
   */
  static async deleteFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;

      const file = await prisma.projectFile.findUnique({
        where: { id: fileId },
        include: {
          project: {
            select: {
              team: {
                select: {
                  team_members: {
                    where: { user_id: req.user!.userId },
                    select: { id: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!file) {
        res.status(404).json({
          success: false,
          message: 'File not found'
        } as UploadResponse);
        return;
      }

      // Check if user has permission to delete
      const hasAccess = req.user!.role === 'director' ||
                       req.user!.role === 'manager' ||
                       file.project.team.team_members.length > 0;

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this file'
        } as UploadResponse);
        return;
      }

      // Clean up the physical file
      await cleanupFile(file.file_path);

      // Delete from database
      await prisma.projectFile.delete({
        where: { id: fileId }
      });

      res.json({
        success: true,
        message: 'File deleted successfully'
      } as UploadResponse);

    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }

  /**
   * Get upload statistics
   */
  static async getUploadStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      let stats: any = {};

      if (userRole === 'director' || userRole === 'manager') {
        // System-wide stats for directors and managers
        const [totalFiles, totalSize, filesByType, recentUploads] = await Promise.all([
          prisma.projectFile.count(),
          prisma.projectFile.aggregate({
            _sum: { file_size: true }
          }),
          prisma.projectFile.groupBy({
            by: ['file_type'],
            _count: { file_type: true }
          }),
          prisma.projectFile.findMany({
            take: 10,
            orderBy: { uploaded_at: 'desc' },
            include: {
              project: {
                select: { name: true }
              },
              uploader: {
                select: { name: true }
              }
            }
          })
        ]);

        stats = {
          total_files: totalFiles,
          total_size_bytes: totalSize._sum.file_size || 0,
          total_size_mb: Math.round(((totalSize._sum.file_size || 0) / (1024 * 1024)) * 100) / 100,
          files_by_type: filesByType.map(type => ({
            type: type.file_type,
            count: type._count.file_type
          })),
          recent_uploads: recentUploads.map(upload => ({
            id: upload.id,
            file_name: upload.file_name,
            file_size: upload.file_size,
            uploaded_at: upload.uploaded_at,
            project_name: upload.project.name,
            uploaded_by: upload.uploader.name
          }))
        };
      } else {
        // User-specific stats for incubators and mentors
        const [userFiles, userTotalSize, recentUploads] = await Promise.all([
          prisma.projectFile.count({
            where: { uploaded_by: userId }
          }),
          prisma.projectFile.aggregate({
            where: { uploaded_by: userId },
            _sum: { file_size: true }
          }),
          prisma.projectFile.findMany({
            where: { uploaded_by: userId },
            take: 5,
            orderBy: { uploaded_at: 'desc' },
            include: {
              project: {
                select: { name: true }
              }
            }
          })
        ]);

        stats = {
          my_files: userFiles,
          my_total_size_bytes: userTotalSize._sum.file_size || 0,
          my_total_size_mb: Math.round(((userTotalSize._sum.file_size || 0) / (1024 * 1024)) * 100) / 100,
          recent_uploads: recentUploads.map(upload => ({
            id: upload.id,
            file_name: upload.file_name,
            file_size: upload.file_size,
            uploaded_at: upload.uploaded_at,
            project_name: upload.project.name
          }))
        };
      }

      res.json({
        success: true,
        message: 'Upload statistics retrieved successfully',
        data: { stats }
      } as UploadResponse);

    } catch (error) {
      console.error('Get upload stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }

  /**
   * Search files
   */
  static async searchFiles(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, project_id, file_type } = req.query;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      const files = await FileService.searchFiles(
        query as string,
        project_id as string,
        file_type as string,
        userId,
        userRole
      );

      res.json({
        success: true,
        message: 'Files searched successfully',
        data: {
          files,
          total: files.length,
          query: query || null,
          filters: {
            project_id,
            file_type
          }
        }
      } as UploadResponse);

    } catch (error) {
      console.error('Search files error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }

  /**
   * Batch delete files
   */
  static async batchDeleteFiles(req: Request, res: Response): Promise<void> {
    try {
      const { file_ids } = req.body;

      if (!Array.isArray(file_ids) || file_ids.length === 0) {
        res.status(400).json({
          success: false,
          message: 'file_ids must be a non-empty array'
        } as UploadResponse);
        return;
      }

      if (file_ids.length > 50) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete more than 50 files at once'
        } as UploadResponse);
        return;
      }

      const userId = req.user!.userId;
      const userRole = req.user!.role;

      const result = await FileService.batchDelete(file_ids, userId, userRole);

      res.json({
        success: true,
        message: `Batch delete completed: ${result.success.length} successful, ${result.failed.length} failed`,
        data: {
          success: result.success,
          failed: result.failed
        }
      } as UploadResponse);

    } catch (error) {
      console.error('Batch delete files error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }

  /**
   * Get project files
   */
  static async getProjectFiles(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { page = 1, limit = 20, file_type } = req.query;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      // Verify project access
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          team: {
            include: {
              team_members: {
                where: { user_id: userId },
                select: { id: true }
              }
            }
          }
        }
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found'
        } as UploadResponse);
        return;
      }

      // Check access permissions
      const hasAccess = userRole === 'director' ||
                       userRole === 'manager' ||
                       project.team.team_members.length > 0;

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to view files in this project'
        } as UploadResponse);
        return;
      }

      // Build where clause
      const where: any = { project_id: projectId };
      if (file_type) {
        where.file_type = { startsWith: file_type as string };
      }

      // Get files with pagination
      const [files, totalCount] = await Promise.all([
        prisma.projectFile.findMany({
          where,
          include: {
            uploader: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { uploaded_at: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit)
        }),
        prisma.projectFile.count({ where })
      ]);

      const totalPages = Math.ceil(totalCount / Number(limit));

      res.json({
        success: true,
        message: 'Project files retrieved successfully',
        data: {
          files: files.map(file => ({
            id: file.id,
            file_name: file.file_name,
            file_path: file.file_path,
            file_type: file.file_type,
            file_size: file.file_size,
            uploaded_at: file.uploaded_at,
            uploader: file.uploader
          })),
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: totalCount,
            pages: totalPages
          },
          project: {
            id: project.id,
            name: project.name,
            team_name: project.team.team_name
          }
        }
      } as UploadResponse);

    } catch (error) {
      console.error('Get project files error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }

  /**
   * Download file (with access logging)
   */
  static async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      const userId = req.user!.userId;

      const file = await prisma.projectFile.findUnique({
        where: { id: fileId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              team: {
                select: {
                  team_members: {
                    where: { user_id: userId },
                    select: { id: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!file) {
        res.status(404).json({
          success: false,
          message: 'File not found'
        } as UploadResponse);
        return;
      }

      // Check access permissions
      const hasAccess = req.user!.role === 'director' ||
                       req.user!.role === 'manager' ||
                       file.project.team.team_members.length > 0;

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to download this file'
        } as UploadResponse);
        return;
      }

      // Log file access
      await FileService.logFileAccess(fileId, userId, 'download', req.ip);

      // For now, return file info - in production you'd stream the file
      res.json({
        success: true,
        message: 'File download initiated',
        data: {
          file: {
            id: file.id,
            file_name: file.file_name,
            file_path: FileService.getFileUrl(file.file_path),
            file_type: file.file_type,
            file_size: file.file_size
          }
        }
      } as UploadResponse);

    } catch (error) {
      console.error('Download file error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }

  /**
   * Clean up project files (admin only)
   */
  static async cleanupProjectFiles(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;

      // Only directors and managers can cleanup project files
      if (req.user!.role !== 'director' && req.user!.role !== 'manager') {
        res.status(403).json({
          success: false,
          message: 'Only directors and managers can perform file cleanup'
        } as UploadResponse);
        return;
      }

      // Verify project exists
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true }
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found'
        } as UploadResponse);
        return;
      }

      await FileService.cleanupProjectFiles(projectId);

      res.json({
        success: true,
        message: `Successfully cleaned up all files for project: ${project.name}`
      } as UploadResponse);

    } catch (error) {
      console.error('Cleanup project files error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as UploadResponse);
    }
  }
}