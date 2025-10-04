import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// File size limits
export const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024, // 5MB for images
  DOCUMENT: 10 * 1024 * 1024, // 10MB for documents
  GENERAL: 10 * 1024 * 1024 // 10MB general limit
};

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ],
  ALL: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
};

// File type validation
export const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ALLOWED_FILE_TYPES.ALL;

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// Local storage configuration
const createLocalStorage = () => {
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with timestamp
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      const basename = path.basename(file.originalname, extension);
      cb(null, `${basename}-${uniqueSuffix}${extension}`);
    }
  });
};

// AWS S3 configuration
const createS3Storage = () => {
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
  });

  return multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET || 'incubation-system-uploads',
    acl: 'private', // Files are private, served via signed URLs
    metadata: (req: Request, file: Express.Multer.File, cb: (error: any, metadata?: any) => void) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req: Request, file: Express.Multer.File, cb: (error: any, key?: string) => void) => {
      // Generate unique key with timestamp
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      const basename = path.basename(file.originalname, extension);
      const key = `uploads/${basename}-${uniqueSuffix}${extension}`;
      cb(null, key);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE
  });
};

// Determine storage type based on environment
const useS3 = process.env.USE_S3 === 'true' && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
const storage = useS3 ? createS3Storage() : createLocalStorage();

// Create multer upload middleware
export const upload = multer({
  storage,
  limits: {
    fileSize: FILE_SIZE_LIMITS.GENERAL,
    files: 10 // Maximum 10 files per upload
  },
  fileFilter
});

// Specialized upload for different file types
export const uploadImages = multer({
  storage,
  limits: {
    fileSize: FILE_SIZE_LIMITS.IMAGE,
    files: 5
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_FILE_TYPES.IMAGES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Only image files are allowed. Allowed types: ${ALLOWED_FILE_TYPES.IMAGES.join(', ')}`));
    }
  }
});

export const uploadDocuments = multer({
  storage,
  limits: {
    fileSize: FILE_SIZE_LIMITS.DOCUMENT,
    files: 5
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_FILE_TYPES.DOCUMENTS.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Only document files are allowed. Allowed types: ${ALLOWED_FILE_TYPES.DOCUMENTS.join(', ')}`));
    }
  }
});

// File cleanup utility
export const cleanupFile = async (filePath: string): Promise<void> => {
  try {
    if (useS3) {
      // For S3, we would need to delete from S3
      // This would require additional S3 client setup
      console.log(`S3 file cleanup not implemented for: ${filePath}`);
    } else {
      // For local storage, delete the file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Error cleaning up file:', error);
  }
};

// Get file URL utility
export const getFileUrl = (file: Express.Multer.File): string => {
  if (useS3) {
    // For S3, return the S3 key (frontend will generate signed URLs)
    return (file as any).key || file.filename;
  } else {
    // For local storage, return the relative path
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    const relativePath = path.relative(uploadDir, file.path);
    return `/uploads/${relativePath}`;
  }
};

// File validation utility
export const validateFile = (file: Express.Multer.File): { valid: boolean; error?: string } => {
  // Check file size
  if (file.size > FILE_SIZE_LIMITS.GENERAL) {
    return { valid: false, error: `File size exceeds limit of ${FILE_SIZE_LIMITS.GENERAL / (1024 * 1024)}MB` };
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.ALL.includes(file.mimetype)) {
    return { valid: false, error: `File type ${file.mimetype} is not allowed` };
  }

  return { valid: true };
};

// Generate file metadata
export const generateFileMetadata = (file: Express.Multer.File) => {
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: getFileUrl(file),
    uploadedAt: new Date(),
    storage: useS3 ? 's3' : 'local'
  };
};