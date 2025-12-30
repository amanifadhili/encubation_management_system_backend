#!/bin/bash
# Deployment script for Encubation Management System Backend
# Run this on the Ubuntu server

set -e

echo "🚀 Starting backend deployment..."

# Navigate to project directory
cd ~/incubation/encubation_management_system_backend

# Pull latest changes if it's a git repo
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes..."
    git pull origin main || git pull origin master || echo "Could not pull, continuing..."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations (if needed)
echo "📊 Running database migrations..."
npx prisma db push --accept-data-loss || echo "Database push completed (or skipped)"

# Build the application
echo "🔨 Building application..."
npm run build

# Create uploads directory if not exists
mkdir -p uploads
mkdir -p logs

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Create PM2 ecosystem config
echo "⚙️  Creating PM2 config..."
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'incubation-backend',
    script: 'dist/src/index.js',
    cwd: '/home/library/incubation/encubation_management_system_backend',
    env: {
      NODE_ENV: 'production',
      PORT: 51524
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF

# Stop existing process if running
echo "🛑 Stopping existing process..."
pm2 delete incubation-backend 2>/dev/null || true

# Start with PM2
echo "▶️  Starting application with PM2..."
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

echo ""
echo "✅ Backend deployment complete!"
echo "🌐 API running at: http://$(hostname -I | awk '{print $1}'):51524"
echo ""
echo "📋 Useful PM2 commands:"
echo "   pm2 list              - List all processes"
echo "   pm2 logs              - View logs"
echo "   pm2 restart all       - Restart all"
echo "   pm2 monit             - Monitor processes"
echo ""

# Show status
pm2 list
