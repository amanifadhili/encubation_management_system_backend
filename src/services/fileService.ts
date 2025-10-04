import fs from 'fs';
import path from 'path';
import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import prisma from '../config/database';

export class FileService {
  private static s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
  });

  private static useS3 = process.env.USE_S3 === 'true';
  private static uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
  private static thumbnailsDir = path.join(this.uploadDir, 'thumbnails');

  /**
   * Initialize file service directories
   */
  static initialize(): void {
    if (!this.useS3) {
      // Ensure upload directories exist
      [this.uploadDir, this.thumbnailsDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });
    }
  }

  /**
   * Generate thumbnail for image files
   */
  static async generateThumbnail(filePath: string, fileName: string): Promise<string | null> {
    try {
      if (this.useS3) {
        // For S3, we'd need to download, process, and re-upload
        // This is a simplified version - in production you'd implement this
        console.log('S3 thumbnail generation not implemented');
        return null;
      }

      const thumbnailName = `thumb_${fileName}`;
      const thumbnailPath = path.join(this.thumbnailsDir, thumbnailName);

      await sharp(filePath)
        .resize(200, 200, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      return thumbnailName;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  }

  /**
   * Clean up files when project is deleted
   */
  static async cleanupProjectFiles(projectId: string): Promise<void> {
    try {
      // Get all files for the project
      const projectFiles = await prisma.projectFile.findMany({
        where: { project_id: projectId }
      });

      // Delete files from storage
      for (const file of projectFiles) {
        await this.deleteFile(file.file_path);
      }

      // Delete file records from database
      await prisma.projectFile.deleteMany({
        where: { project_id: projectId }
      });

      console.log(`Cleaned up ${projectFiles.length} files for project ${projectId}`);
    } catch (error) {
      console.error('Error cleaning up project files:', error);
      throw error;
    }
  }

  /**
   * Delete a single file from storage
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      if (this.useS3) {
        // Extract key from S3 URL or path
        const key = filePath.startsWith('uploads/') ? filePath : `uploads/${path.basename(filePath)}`;

        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET || '',
          Key: key
        });

        await this.s3Client.send(deleteCommand);
      } else {
        // Delete from local storage
        const fullPath = path.join(this.uploadDir, filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }

        // Also delete thumbnail if it exists
        const thumbnailPath = path.join(this.thumbnailsDir, `thumb_${path.basename(filePath)}`);
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Create file version (for versioning system)
   */
  static async createFileVersion(
    projectId: string,
    originalFileId: string,
    newFilePath: string,
    version: number,
    userId: string
  ): Promise<void> {
    try {
      // This would create a version record in a file_versions table
      // For now, we'll just log the version info
      console.log(`Created version ${version} for file ${originalFileId} in project ${projectId}`);

      // In a full implementation, you'd create a file_versions table
      // and store version metadata
    } catch (error) {
      console.error('Error creating file version:', error);
      throw error;
    }
  }

  /**
   * Search files by name, type, or project
   */
  static async searchFiles(
    query: string,
    projectId?: string,
    fileType?: string,
    userId?: string,
    userRole?: string
  ): Promise<any[]> {
    try {
      const where: any = {};

      // Add search query
      if (query) {
        where.file_name = {
          contains: query,
          mode: 'insensitive'
        };
      }

      // Filter by project if specified
      if (projectId) {
        where.project_id = projectId;
      }

      // Filter by file type
      if (fileType) {
        where.file_type = {
          startsWith: fileType
        };
      }

      // Add access control based on user role
      if (userRole !== 'director' && userRole !== 'manager') {
        // For non-admin users, only show files from their projects
        where.project = {
          team: {
            team_members: {
              some: { user_id: userId }
            }
          }
        };
      }

      const files = await prisma.projectFile.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              team: {
                select: {
                  team_name: true
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
        },
        orderBy: { uploaded_at: 'desc' },
        take: 50 // Limit results
      });

      return files.map(file => ({
        id: file.id,
        file_name: file.file_name,
        file_path: file.file_path,
        file_type: file.file_type,
        file_size: file.file_size,
        uploaded_at: file.uploaded_at,
        project: file.project,
        uploader: file.uploader
      }));
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  /**
   * Get file statistics
   */
  static async getFileStatistics(userId?: string, userRole?: string): Promise<any> {
    try {
      let where: any = {};

      // Add access control for non-admin users
      if (userRole !== 'director' && userRole !== 'manager') {
        where.project = {
          team: {
            team_members: {
              some: { user_id: userId }
            }
          }
        };
      }

      const [
        totalFiles,
        totalSize,
        filesByType,
        recentFiles,
        largestFiles
      ] = await Promise.all([
        // Total file count
        prisma.projectFile.count({ where }),

        // Total size
        prisma.projectFile.aggregate({
          where,
          _sum: { file_size: true }
        }),

        // Files by type
        prisma.projectFile.groupBy({
          by: ['file_type'],
          where,
          _count: { file_type: true }
        }),

        // Recent files
        prisma.projectFile.findMany({
          where,
          include: {
            project: {
              select: { name: true }
            },
            uploader: {
              select: { name: true }
            }
          },
          orderBy: { uploaded_at: 'desc' },
          take: 10
        }),

        // Largest files
        prisma.projectFile.findMany({
          where,
          include: {
            project: {
              select: { name: true }
            },
            uploader: {
              select: { name: true }
            }
          },
          orderBy: { file_size: 'desc' },
          take: 10
        })
      ]);

      return {
        total_files: totalFiles,
        total_size_bytes: totalSize._sum.file_size || 0,
        total_size_mb: Math.round(((totalSize._sum.file_size || 0) / (1024 * 1024)) * 100) / 100,
        files_by_type: filesByType.map(type => ({
          type: type.file_type,
          count: type._count.file_type
        })),
        recent_files: recentFiles.map(file => ({
          id: file.id,
          file_name: file.file_name,
          file_size: file.file_size,
          uploaded_at: file.uploaded_at,
          project_name: file.project.name,
          uploader_name: file.uploader.name
        })),
        largest_files: largestFiles.map(file => ({
          id: file.id,
          file_name: file.file_name,
          file_size: file.file_size,
          uploaded_at: file.uploaded_at,
          project_name: file.project.name,
          uploader_name: file.uploader.name
        }))
      };
    } catch (error) {
      console.error('Error getting file statistics:', error);
      throw error;
    }
  }

  /**
   * Log file access for audit purposes
   */
  static async logFileAccess(
    fileId: string,
    userId: string,
    action: 'view' | 'download' | 'delete',
    ipAddress?: string
  ): Promise<void> {
    try {
      // In a full implementation, you'd create a file_access_logs table
      console.log(`File ${fileId} accessed by user ${userId}: ${action} from ${ipAddress || 'unknown'}`);

      // You could store this in a database table for audit purposes
      // await prisma.fileAccessLog.create({
      //   data: {
      //     file_id: fileId,
      //     user_id: userId,
      //     action,
      //     ip_address: ipAddress,
      //     accessed_at: new Date()
      //   }
      // });
    } catch (error) {
      console.error('Error logging file access:', error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Validate file before upload
   */
  static validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    const maxSizes = {
      image: 5 * 1024 * 1024, // 5MB
      document: 10 * 1024 * 1024, // 10MB
      general: 10 * 1024 * 1024 // 10MB
    };

    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      return { valid: false, error: `File type ${file.mimetype} is not allowed` };
    }

    // Check file size
    let maxSize = maxSizes.general;
    if (file.mimetype.startsWith('image/')) {
      maxSize = maxSizes.image;
    } else if (file.mimetype.includes('document') || file.mimetype.includes('pdf') || file.mimetype.includes('excel')) {
      maxSize = maxSizes.document;
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds limit of ${maxSize / (1024 * 1024)}MB for ${file.mimetype.startsWith('image/') ? 'images' : 'documents'}`
      };
    }

    return { valid: true };
  }

  /**
   * Get file URL for serving
   */
  static getFileUrl(filePath: string): string {
    if (this.useS3) {
      // For S3, return signed URL or public URL
      const bucket = process.env.AWS_S3_BUCKET;
      const region = process.env.AWS_REGION || 'us-east-1';
      return `https://${bucket}.s3.${region}.amazonaws.com/${filePath}`;
    } else {
      // For local storage, return relative path
      return `/uploads/${filePath}`;
    }
  }

  /**
   * Batch file operations
   */
  static async batchDelete(fileIds: string[], userId: string, userRole: string): Promise<{ success: string[], failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const fileId of fileIds) {
      try {
        // Check permissions
        const file = await prisma.projectFile.findUnique({
          where: { id: fileId },
          include: {
            project: {
              select: {
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
          failed.push(`${fileId}: File not found`);
          continue;
        }

        // Check permissions
        const hasPermission = userRole === 'director' ||
                             userRole === 'manager' ||
                             file.uploaded_by === userId ||
                             file.project.team.team_members.length > 0;

        if (!hasPermission) {
          failed.push(`${fileId}: Permission denied`);
          continue;
        }

        // Delete file
        await this.deleteFile(file.file_path);
        await prisma.projectFile.delete({ where: { id: fileId } });

        success.push(fileId);
      } catch (error) {
        console.error(`Error deleting file ${fileId}:`, error);
        failed.push(`${fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success, failed };
  }
}

// Initialize file service
FileService.initialize();