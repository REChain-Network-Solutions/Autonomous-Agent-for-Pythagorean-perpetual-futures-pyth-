# Autonomous Agent for Pythagorean Perpetual Futures

A sophisticated autonomous trading agent implementing Pythagorean geometric risk distribution for perpetual futures trading.

## 🚀 Features

### Core Trading Engine
- **Pythagorean Risk Model**: Geometric distribution of risk across positions
- **Multiple Strategies**: Momentum, Mean Reversion, Breakout, Scalping, Swing trading
- **Advanced Risk Management**: VaR, drawdown protection, correlation analysis
- **Real-time Position Management**: Automatic entry/exit with stop-loss and take-profit

### Analytics & Monitoring
- **Live Dashboard**: Real-time performance visualization
- **Performance Metrics**: Sharpe ratio, win rate, drawdown tracking
- **Risk Analytics**: Portfolio-level risk assessment
- **Alert System**: Comprehensive monitoring with webhook integration

### API & Integration
- **RESTful API**: Full CRUD operations for trading and monitoring
- **Authentication**: API key-based security
- **Swagger Documentation**: Interactive API documentation
- **Webhook Support**: Real-time notifications

### Infrastructure
- **Docker Support**: Containerized deployment
- **Graceful Shutdown**: Proper cleanup and error handling
- **Configuration Management**: Environment-based configuration
- **Logging**: Structured logging with multiple levels

## 📊 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Server    │    │  Trading Engine │    │   Risk Manager  │
│                 │    │                 │    │                 │
│ • REST Endpoints│    │ • Strategy Exec │    │ • Risk Limits   │
│ • Authentication│    │ • Position Mgmt │    │ • VaR Analysis  │
│ • Rate Limiting │    │ • Market Data   │    │ • Emergency Stop│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Alert System    │
                    │                 │
                    │ • Monitoring    │
                    │ • Notifications │
                    │ • Webhooks      │
                    └─────────────────┘
```

## 🛠️ Installation

### Prerequisites
- Node.js >= 14.0.0
- npm or yarn
- Docker (optional)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd autonomous-agent-pythagorean-futures
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp config/default.json config/production.json
   # Edit configuration as needed
   ```

4. **Start the agent**
   ```bash
   npm start
   ```

5. **Access the dashboard**
   - API Documentation: http://localhost:3000/api-docs
   - Health Check: http://localhost:3000/health

## 📖 API Documentation

### Authentication
All API endpoints require authentication via API key:

```bash
curl -H "x-api-key: your-api-key" http://localhost:3000/api/positions
```

### Core Endpoints

#### Trading
```bash
# Execute a trade
POST /api/trade
{
  "asset": "BTC",
  "side": "BUY",
  "size": 100,
  "strategy": "momentum"
}

# Get positions
GET /api/positions

# Close position
DELETE /api/positions/BTC
```

#### Analytics
```bash
# Get dashboard data
GET /api/analytics/dashboard

# Get performance metrics
GET /api/analytics/performance

# Get risk assessment
GET /api/risk/assessment
```

#### Market Data
```bash
# Update market data
POST /api/market
[{
  "asset": "BTC",
  "price": 50000,
  "bid": 49950,
  "ask": 50050,
  "volume": 1000
}]

# Get market data
GET /api/market/BTC
```

#### Alerts
```bash
# Get active alerts
GET /api/alerts

# Get alert statistics
GET /api/alerts/stats
```

## ⚙️ Configuration

### Environment Variables
```bash
PORT=3000
API_KEY=your-secret-key
WEBHOOK_URL=https://your-webhook-endpoint.com
```

### Configuration File
```json
{
  "server": {
    "port": 3000,
    "apiKey": "your-api-key",
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
```

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Alert system tests
npm test -- test/alertSystem.test.js

# API tests
npm test -- test/api.test.js

# Trading engine tests
npm test -- test/tradingEngine.test.js
```

### Test Coverage
```bash
npm run test:coverage
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build the image
docker build -t pythagorean-agent .

# Run the container
docker run -p 3000:3000 pythagorean-agent
```

### Docker Compose
```yaml
version: '3.8'
services:
  agent:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - API_KEY=your-production-key
    volumes:
      - ./config:/app/config
      - ./logs:/app/logs
```

### Production Checklist
- [ ] Set NODE_ENV=production
- [ ] Configure production database
- [ ] Set up monitoring and alerting
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Configure firewall rules
- [ ] Set up log rotation
- [ ] Configure backup strategy

## 📈 Trading Strategies

### 1. Momentum Strategy
Trades based on price momentum indicators. Enters positions when momentum exceeds threshold.

**Parameters:**
- `momentum_threshold`: Minimum momentum required (default: 0.02)
- `volume_threshold`: Minimum volume required (default: 1000)

### 2. Mean Reversion Strategy
Trades based on mean reversion signals. Enters when price deviates significantly from mean.

**Parameters:**
- `z_score_threshold`: Z-score threshold for entry (default: 2.0)
- `rsi_levels`: RSI overbought/oversold levels (default: [30, 70])

### 3. Breakout Strategy
Trades on price breakouts above resistance or below support levels.

**Parameters:**
- `breakout_percentage`: Percentage move required (default: 0.02)
- `confirmation_period`: Candles for confirmation (default: 3)

### 4. Scalping Strategy
Quick trades based on small price movements with tight stop-loss.

**Parameters:**
- `tick_size`: Minimum price movement (default: 0.001)
- `exit_threshold`: Profit target in ticks (default: 5)

### 5. Swing Strategy
Longer-term trend following trades.

**Parameters:**
- `trend_period`: Period for trend calculation (default: 20)
- `support_resistance_levels`: Number of levels to track (default: 3)

## ⚠️ Risk Management

### Risk Limits
- **Position Size**: Maximum 10% of portfolio per position
- **Drawdown**: Maximum 20% portfolio drawdown
- **Daily Loss**: Maximum 10% daily loss limit
- **VaR**: Maximum 15% Value at Risk
- **Correlation**: Maximum 80% correlation between positions

### Emergency Controls
```bash
# Trigger emergency stop
curl -X POST http://localhost:3000/api/risk/emergency-stop \
  -H "x-api-key: your-api-key" \
  -d '{"reason": "Manual emergency stop"}'
```

### Risk Assessment
```bash
# Get current risk assessment
curl http://localhost:3000/api/risk/assessment \
  -H "x-api-key: your-api-key"
```

## 📊 Monitoring & Alerts

### Alert Types
- **INFO**: General information
- **WARNING**: Potential issues requiring attention
- **ERROR**: Critical errors requiring immediate action
- **CRITICAL**: System-threatening conditions

### Alert Channels
- **Console**: Local logging
- **File**: Persistent log files
- **Webhook**: External notification systems
- **Email**: SMTP notifications (configurable)

### Health Monitoring
- **System Resources**: CPU, memory, disk usage
- **API Performance**: Response times, error rates
- **Trading Performance**: Win rate, drawdown, PnL
- **Risk Metrics**: VaR, correlation, leverage

## 🔧 Development

### Project Structure
```
├── src/
│   ├── main.js              # Application entry point
│   ├── enhancedServer.js    # API server
│   ├── tradingEngine.js     # Trading logic
│   ├── riskManager.js       # Risk management
│   ├── alertSystem.js       # Alert system
│   └── analyticsDashboard.js # Analytics
├── config/
│   └── default.json         # Configuration
├── test/
│   ├── alertSystem.test.js
│   ├── tradingEngine.test.js
│   └── api.test.js
├── docs/
│   └── README.md           # This file
└── package.json
```

### Adding New Strategies
1. Implement strategy logic in `tradingEngine.js`
2. Add strategy configuration
3. Update API documentation
4. Add tests

### Extending API
1. Add routes in `enhancedServer.js`
2. Implement business logic
3. Add validation and error handling
4. Update tests and documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Code Standards
- ESLint configuration for code quality
- Comprehensive test coverage required
- Clear documentation for all features
- Semantic versioning for releases

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Troubleshooting
- Check logs in `./logs/` directory
- Verify configuration in `config/default.json`
- Test API endpoints with curl
- Check system resources and network connectivity

### Common Issues
1. **Port already in use**: Change port in configuration
2. **API key rejected**: Verify API key in requests
3. **Market data not updating**: Check market data source configuration
4. **High memory usage**: Monitor system resources and adjust limits

### Getting Help
- Check the API documentation at `/api-docs`
- Review the logs for error messages
- Test individual components with unit tests
- Check configuration against examples

---

**Built with ❤️ for automated trading excellence**
