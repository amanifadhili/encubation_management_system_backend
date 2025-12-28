import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import prisma, { testConnection } from './config/database';
import { SocketHandler } from './socket/socketHandler';
import { setSocketHandler } from './services/socketService';
import { SecurityMiddleware } from './config/security';
import { errorHandler, notFoundHandler, requestLogger, healthCheck } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import teamRoutes from './routes/teams';
import projectRoutes from './routes/projects';
import mentorRoutes from './routes/mentors';
import inventoryRoutes from './routes/inventory';
import requestRoutes from './routes/requests';
import messageRoutes from './routes/messages';
import notificationRoutes from './routes/notifications';
import announcementRoutes from './routes/announcements';
import reportsRoutes from './routes/reports';
import dashboardRoutes from './routes/dashboard';
import uploadRoutes from './routes/upload';
import emailPreferencesRoutes from './routes/emailPreferences';
import emailRoutes from './routes/email';
import locationRoutes from './routes/locations';
import supplierRoutes from './routes/suppliers';
import consumptionRoutes from './routes/consumption';
import reservationRoutes from './routes/reservations';
import maintenanceRoutes from './routes/maintenance';
import requestTemplateRoutes from './routes/requestTemplates';
import barcodeRoutes from './routes/barcode';

// Load environment variables
dotenv.config();


const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize Socket.io
const socketHandler = new SocketHandler(server);
setSocketHandler(socketHandler);

// Security Middleware (CORS will handle OPTIONS preflight automatically)
SecurityMiddleware.applySecurity(app);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use(requestLogger);
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/email-preferences', emailPreferencesRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/consumption', consumptionRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/request-templates', requestTemplateRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api', messageRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'Incubation Management System Backend API',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      teams: '/api/teams',
      projects: '/api/projects',
      mentors: '/api/mentors',
      inventory: '/api/inventory',
      requests: '/api/requests',
      notifications: '/api/notifications',
      announcements: '/api/announcements',
      reports: '/api/reports',
      upload: '/api/upload',
      conversations: '/api/conversations',
      health: '/health'
    }
  });
});

// Health check
app.get('/health', healthCheck);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;