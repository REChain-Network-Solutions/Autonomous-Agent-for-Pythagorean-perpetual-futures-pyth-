# REChain ® Autonomous Agent for Pythagorean Perpetual Futures

A sophisticated autonomous trading agent implementing Pythagorean geometric risk distribution for perpetual futures trading.

## 🚀 Features

- **Pythagorean Risk Model**: Geometric distribution of risk across positions
- **Oracle Integrations**: Katya, Pyth, and custom oracle support
- **Automated Position Sizing**: Intelligent position management based on risk metrics
- **Smart Contract Execution**: Direct interaction with DeFi protocols
- **Adaptive Strategy Switching**: Dynamic strategy selection based on market conditions
- **Real-time Monitoring**: Live dashboard and performance metrics
- **Advanced Risk Management**: VaR analysis, drawdown protection, correlation limits

## 🏁 Quick Start

### Prerequisites
- Node.js >= 14.0.0
- npm or yarn

### Installation

```bash
git clone https://github.com/REChain-Network-Solutions/Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-.git
cd Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-
npm install
```

### Configuration

Copy the environment template and configure your settings:

```bash
cp .env.example .env
```

Edit the `.env` file with your specific configuration.

### Running the Agent

```bash
npm start
```

The agent will start on http://localhost:3000 (default port).

## ⚙️ Configuration

See `.env.example` for comprehensive configuration options. Key environment variables include:

- `API_KEY`: Secret API key for authentication
- `PORT`: Server port (default: 3000)
- `INITIAL_CASH`: Initial trading capital
- `MAX_POSITION_SIZE`: Maximum position size per trade
- `MAX_DRAWDOWN`: Maximum allowed drawdown percentage
- `STOP_LOSS_PERCENT`: Stop-loss percentage
- `TAKE_PROFIT_PERCENT`: Take-profit percentage
- `LEVERAGE`: Trading leverage

## 📖 API Documentation

### Authentication
All API endpoints require authentication via API key in the `x-api-key` header.

### Core Endpoints

- **Health Check**: `GET /healthz`
- **Readiness Check**: `GET /readyz`
- **Metrics Status**: `GET /metrics/status`
- **Positions**: `GET /metrics/positions`
- **Performance**: `GET /metrics/performance`

### Admin Endpoints (require admin token)

- **Manual Refresh**: `POST /admin/refresh-metrics`
- **Webhook Management**: `POST/DELETE/GET /admin/hooks`
- **Event Emission**: `POST /admin/emit`
- **Configuration View**: `GET /admin/config`
- **Session Management**: `GET/DELETE /admin/sessions`

### Web3 Authentication

- **Nonce Generation**: `GET /web3/nonce`
- **Signature Verification**: `POST /web3/verify`

### Real-time Streaming

- **SSE Metrics Stream**: `GET /metrics/stream` (Server-Sent Events)

For detailed API specification, see [`openapi.yaml`](openapi.yaml) or visit `/docs` when the server is running.

## 🐳 Docker Deployment

### Build the Image

```bash
docker build -t pyth-aa .
```

### Run the Container

```bash
docker run -p 3000:3000 --env-file .env pyth-aa
```

### Docker Compose

```bash
docker-compose up --build
```

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
npm test -- test/alertSystem.test.js
npm test -- test/api.test.js
npm test -- test/tradingEngine.test.js
```

### Lint Code

```bash
npm run lint
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 💬 Support

- [Telegram](https://t.me/REChainDAO)
- [Discord](https://discord.gg/rechain)
- [GitHub Issues](https://github.com/REChain-Network-Solutions/Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-/issues)

## ❤️ Donations

We accept donations through [KatyaAI](https://KatyaAI.org) and forward a portion to other open-source projects that made Pyth possible.

