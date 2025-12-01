# Incubation Management System Backend

A comprehensive Node.js/Express backend API for the Incubation Management System, built with TypeScript, MySQL, and Socket.io.

## 🚀 Features

- **RESTful API**: Complete CRUD operations for all system entities
- **Authentication**: JWT-based authentication with role-based access control
- **Real-time Communication**: Socket.io integration for messaging
- **File Upload**: Support for project files and documents
- **Database**: MySQL with Prisma ORM
- **Security**: Helmet, CORS, rate limiting, input validation

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MySQL
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **Real-time**: Socket.io
- **Validation**: Joi
- **File Upload**: Multer

## 📁 Project Structure

```
src/
├── config/          # Database and app configuration
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── prisma/         # Prisma schema and migrations
├── routes/         # API routes
├── services/       # Business logic services
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd encubation_management_system_backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Set up database**
   ```bash
   # Create MySQL database
   CREATE DATABASE incubation_db;

   # Run migrations (when implemented)
   npm run migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Teams Management
- `GET /api/teams` - List teams
- `POST /api/teams` - Create team
- `GET /api/teams/:id` - Get team details
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### And more endpoints for mentors, inventory, messaging, etc.

## 🔐 User Roles

- **Director**: Full system access
- **Manager**: Operational management
- **Mentor**: Team-specific guidance
- **Incubator**: Team-focused operations

## 🧪 Testing

```bash
# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

## 🚀 Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 📝 Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=incubation_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# Server
PORT=3001
NODE_ENV=production

# CORS
CORS_ORIGIN=https://your-frontend-domain.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is part of the Incubation Management System.