#!/bin/bash

# Deployment script for Pythagorean Agent
# Usage: ./scripts/deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
PROJECT_NAME="pythagorean-agent"
DOCKER_IMAGE="${PROJECT_NAME}:${ENVIRONMENT}"

echo "🚀 Deploying ${PROJECT_NAME} to ${ENVIRONMENT} environment"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs data config

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    echo "🔧 Loading environment variables from .env.${ENVIRONMENT}"
    export $(cat .env.${ENVIRONMENT} | xargs)
elif [ -f ".env" ]; then
    echo "🔧 Loading environment variables from .env"
    export $(cat .env | xargs)
fi

# Validate required environment variables
if [ -z "$API_KEY" ]; then
    echo "⚠️  Warning: API_KEY not set. Using default (not recommended for production)"
    export API_KEY="default-api-key-change-in-production"
fi

# Build the application
echo "🔨 Building Docker image..."
docker build -t ${DOCKER_IMAGE} .

# Tag as latest if production
if [ "$ENVIRONMENT" = "production" ]; then
    docker tag ${DOCKER_IMAGE} ${PROJECT_NAME}:latest
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down || true

# Clean up unused images (optional)
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🧹 Cleaning up unused Docker images..."
    docker image prune -f
fi

# Start the application
echo "▶️  Starting ${PROJECT_NAME}..."
if [ "$ENVIRONMENT" = "production" ]; then
    docker-compose up -d
else
    docker-compose up -d
fi

# Wait for health check
echo "🏥 Waiting for application to be healthy..."
MAX_ATTEMPTS=30
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ Application is healthy!"
        break
    fi

    echo "⏳ Waiting for application to be ready... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep 10
    ((ATTEMPT++))
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo "❌ Application failed to start properly"
    echo "📋 Checking logs..."
    docker-compose logs
    exit 1
fi

# Run post-deployment checks
echo "🔍 Running post-deployment checks..."

# Check API endpoints
echo "Testing health endpoint..."
curl -s http://localhost:3000/health | head -20

echo "Testing API docs..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api-docs

# Show status
echo "📊 Deployment status:"
docker-compose ps

# Show logs
echo "📝 Recent logs:"
docker-compose logs --tail=20

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Useful commands:"
echo "  • View logs: docker-compose logs -f"
echo "  • Stop application: docker-compose down"
echo "  • Restart application: docker-compose restart"
echo "  • Update application: ./scripts/deploy.sh ${ENVIRONMENT}"
echo ""
echo "🌐 Application URLs:"
echo "  • API: http://localhost:3000"
echo "  • Health Check: http://localhost:3000/health"
echo "  • API Documentation: http://localhost:3000/api-docs"
echo ""
echo "🔐 API Key: ${API_KEY}"
