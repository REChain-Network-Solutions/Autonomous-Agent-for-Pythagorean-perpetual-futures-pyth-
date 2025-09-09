# Installation & Setup Guide

Comprehensive installation and setup instructions for the REChain Autonomous Agent for Pythagorean Perpetual Futures.

## 📋 Prerequisites

### System Requirements
- **Node.js**: >= 14.0.0
- **npm**: >= 6.0.0 or **yarn**: >= 1.22.0
- **Operating System**: Linux, macOS, or Windows (WSL recommended for Windows)
- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Storage**: Minimum 500MB free space

### Optional Dependencies
- **Docker**: >= 20.10.0 (for containerized deployment)
- **Docker Compose**: >= 2.0.0 (for multi-container setup)
- **PostgreSQL**: >= 12.0 (for persistent metrics storage)

## 🚀 Quick Installation

### Method 1: Standard Installation (Recommended)

```bash
# Clone the repository
git clone https://github.com/REChain-Network-Solutions/Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-.git
cd Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-

# Install dependencies
npm install

# Or using yarn
yarn install

# Configure environment
cp .env.example .env

# Edit the configuration file
# See Configuration section below for details

# Start the agent
npm start

# Or for development with auto-reload
npm run dev
```

### Method 2: Docker Installation

```bash
# Clone the repository
git clone https://github.com/REChain-Network-Solutions/Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-.git
cd Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-

# Build the Docker image
docker build -t pythagorean-agent .

# Run the container
docker run -p 3000:3000 \
  --name pythagorean-agent \
  --env-file .env \
  pythagorean-agent

# Or use Docker Compose
docker-compose up --build
```

### Method 3: Development Setup

```bash
# Clone and setup
git clone <repository-url>
cd autonomous-agent-pythagorean-futures

# Install dependencies
npm install

# Setup development environment
npm run setup:dev

# Start development server with hot reload
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

## ⚙️ Configuration

### Environment Variables

Copy the example environment file and customize it for your setup:

```bash
cp .env.example .env
```

Edit the `.env` file with your specific configuration:

```bash
# Application Environment
NODE_ENV=development
PORT=3000
API_KEY=your-secret-api-key-here

# External Services
WEBHOOK_URL=https://your-webhook-endpoint.com
DATABASE_URL=postgresql://user:password@localhost:5432/pythagorean_agent

# Trading Configuration
INITIAL_CASH=100000
MAX_POSITION_SIZE=0.1
MAX_DRAWDOWN=0.2
STOP_LOSS_PERCENT=0.05
TAKE_PROFIT_PERCENT=0.1
LEVERAGE=1

# Risk Management
MAX_DAILY_LOSS=0.1
MAX_LEVERAGE=5
VAR_LIMIT=0.15
CORRELATION_LIMIT=0.8

# Alert System
ERROR_RATE_THRESHOLD=0.05
RESPONSE_TIME_THRESHOLD=5000

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Development
DEBUG=true
DEV_MODE=true
```

### Configuration Files

The agent uses multiple configuration sources:

1. **Environment variables** (highest priority)
2. **config/production.json** (production environment)
3. **config/default.json** (default values)

Create production configuration:

```bash
cp config/default.json config/production.json
# Edit config/production.json for production settings
```

## 🔧 Advanced Setup

### Database Setup (Optional)

For persistent metrics storage:

```bash
# Install PostgreSQL
# On Ubuntu/Debian:
sudo apt-get install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE pythagorean_agent;
CREATE USER pythagorean_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE pythagorean_agent TO pythagorean_user;

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://pythagorean_user:your_password@localhost:5432/pythagorean_agent
```

### Reverse Proxy Setup (Production)

#### Nginx Configuration

```nginx
# /etc/nginx/sites-available/pythagorean-agent
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal setup
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Systemd Service (Production)

Create a systemd service file:

```bash
# /etc/systemd/system/pythagorean-agent.service
[Unit]
Description=REChain Pythagorean Agent
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/autonomous-agent-pythagorean-futures
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pythagorean-agent
sudo systemctl start pythagorean-agent
sudo systemctl status pythagorean-agent
```

## 🐳 Docker Deployment

### Docker Compose Example

```yaml
# docker-compose.yml
version: '3.8'
services:
  agent:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - API_KEY=${API_KEY}
      - DATABASE_URL=postgresql://postgres:password@db:5432/pythagorean_agent
    depends_on:
      - db
    volumes:
      - ./logs:/app/logs
      - ./config:/app/config

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=pythagorean_agent
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Environment File for Docker

Create `.env` for Docker:

```bash
API_KEY=your-production-api-key
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@db:5432/pythagorean_agent
```

## 🧪 Testing Setup

### Run Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- test/alertSystem.test.js
npm test -- test/api.test.js
npm test -- test/tradingEngine.test.js

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Test Configuration

Create test environment:

```bash
cp .env.example .env.test
# Edit .env.test for test-specific settings
```

## 📊 Monitoring Setup

### Logging Configuration

The agent uses structured logging with multiple outputs:

```javascript
// Logging configuration
const logger = {
  level: process.env.LOG_LEVEL || 'info',
  file: process.env.LOG_FILE || 'logs/app.log',
  console: process.env.NODE_ENV !== 'production'
};
```

### Health Checks

The agent provides built-in health endpoints:

- `GET /healthz` - Liveness probe
- `GET /readyz` - Readiness probe
- `GET /metrics` - Prometheus metrics (if enabled)

### Alerting Configuration

Configure alert thresholds in your `.env`:

```bash
# Alert thresholds
ERROR_RATE_THRESHOLD=0.05
RESPONSE_TIME_THRESHOLD=5000

# Webhook for alerts
WEBHOOK_URL=https://your-alert-webhook.com
```

## 🔐 Security Setup

### API Key Generation

Generate a secure API key:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using openssl
openssl rand -hex 32
```

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 3000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### SSL Configuration

For production, always use HTTPS:

```bash
# Use reverse proxy with SSL termination
# Or configure Node.js with SSL directly
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
};

https.createServer(options, app).listen(3000);
```

## 🚀 Production Checklist

Before going to production:

- [ ] Set `NODE_ENV=production`
- [ ] Generate secure API keys
- [ ] Configure database connection
- [ ] Set up SSL certificates
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Configure log rotation
- [ ] Set up backup strategy
- [ ] Test failover and recovery
- [ ] Load test the system
- [ ] Set up CI/CD pipeline

## 🆘 Troubleshooting

Common issues and solutions:

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in configuration
PORT=3001
```

### Database Connection Issues
- Check database server is running
- Verify connection string in `.env`
- Check firewall rules

### Permission Issues
```bash
# Fix file permissions
chmod -R 755 /path/to/agent
chown -R www-data:www-data /path/to/agent
```

### Memory Issues
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 src/main.js
```

## 📚 Additional Resources

- [API Documentation](../api-doc.md)
- [OpenAPI Specification](../openapi.yaml)
- [Wiki Documentation](../wiki.md)
- [REChain Network Solutions](https://rechain.network)

## 💬 Support

For installation issues:
- Check the [troubleshooting section](#-troubleshooting)
- Review server logs for error details
- Create issues on [GitHub](https://github.com/REChain-Network-Solutions/Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-/issues)
- Join our [Discord](https://discord.gg/rechain) for community support

---

**Happy trading!** 🚀