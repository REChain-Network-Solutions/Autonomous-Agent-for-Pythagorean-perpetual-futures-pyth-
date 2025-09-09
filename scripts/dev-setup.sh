#!/bin/bash

# Development setup script for Pythagorean Agent
# This script sets up the development environment

set -e

echo "🚀 Setting up Pythagorean Agent development environment"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | cut -d'v' -f2)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ Node.js version 14 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs data config

# Copy configuration template
if [ ! -f "config/default.json" ]; then
    echo "⚠️  Configuration file not found. Creating template..."
    cat > config/default.json << EOF
{
  "server": {
    "port": 3000,
    "apiKey": "dev-api-key-change-in-production",
    "corsOrigins": ["http://localhost:3000"]
  },
  "trading": {
    "initialCash": 100000,
    "maxPositionSize": 0.1,
    "maxDrawdown": 0.2,
    "stopLossPercent": 0.05,
    "takeProfitPercent": 0.1,
    "leverage": 1
  },
  "risk": {
    "maxDailyLoss": 0.1,
    "maxLeverage": 5,
    "varLimit": 0.15,
    "correlationLimit": 0.8
  },
  "alerts": {
    "errorRateThreshold": 0.05,
    "responseTimeThreshold": 5000,
    "webhookUrl": null
  }
}
EOF
fi

# Create .env file for development
if [ ! -f ".env" ]; then
    echo "🔧 Creating .env file..."
    cat > .env << EOF
NODE_ENV=development
API_KEY=dev-api-key-change-in-production
WEBHOOK_URL=
DATABASE_URL=
EOF
fi

# Run linting
echo "🔍 Running linter..."
npm run lint || echo "⚠️  Linting completed with warnings/errors"

# Run tests
echo "🧪 Running tests..."
npm test || echo "⚠️  Tests completed with failures"

# Build documentation
echo "📚 Building documentation..."
# Add documentation build commands here if needed

echo ""
echo "🎉 Development environment setup completed!"
echo ""
echo "📋 Next steps:"
echo "  • Start development server: npm run dev"
echo "  • Run tests: npm test"
echo "  • View API docs: http://localhost:3000/api-docs"
echo "  • Check health: http://localhost:3000/health"
echo ""
echo "🔧 Useful commands:"
echo "  • Start server: npm start"
echo "  • Run linting: npm run lint"
echo "  • Run tests: npm test"
echo "  • Clean install: rm -rf node_modules && npm install"
echo ""
echo "📁 Project structure:"
echo "  • src/ - Source code"
echo "  • test/ - Test files"
echo "  • config/ - Configuration files"
echo "  • docs/ - Documentation"
echo "  • logs/ - Application logs"
echo "  • data/ - Application data"
