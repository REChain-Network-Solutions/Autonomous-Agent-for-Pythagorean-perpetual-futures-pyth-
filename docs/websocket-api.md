# WebSocket API Documentation

## Overview

The REChain Autonomous Agent provides real-time WebSocket connections for streaming live updates about trading activities, market data, alerts, analytics, and risk management events.

## Connection

### WebSocket URL
```
ws://localhost:3000
```

### Connection Parameters
- **Protocol**: WebSocket (ws://) or Secure WebSocket (wss://)
- **Authentication**: API key in query parameter or header (if required)
- **Heartbeat**: Automatic ping/pong for connection health

### Example Connection
```javascript
const ws = new WebSocket('ws://localhost:3000?apiKey=your-api-key');
```

## Message Format

All WebSocket messages follow a consistent JSON format:

```json
{
  "type": "event_type",
  "data": {
    // Event-specific data
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Event Types

### Trading Events

#### `trade_update`
Triggered when positions are opened, modified, or closed.

```json
{
  "type": "trade_update",
  "data": {
    "action": "open|close|modify",
    "position": {
      "id": "pos_123",
      "asset": "BTC",
      "side": "LONG",
      "size": 1.5,
      "entryPrice": 45000,
      "currentPrice": 45100,
      "pnl": 150,
      "pnlPercent": 0.33,
      "status": "OPEN"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### `position_closed`
Specific event for position closures with detailed P&L information.

```json
{
  "type": "position_closed",
  "data": {
    "positionId": "pos_123",
    "asset": "BTC",
    "entryPrice": 45000,
    "exitPrice": 45200,
    "pnl": 300,
    "pnlPercent": 0.67,
    "holdTime": "2h 30m",
    "reason": "take_profit|stop_loss|manual"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Market Data Events

#### `market_data`
Real-time market data updates for all tracked assets.

```json
{
  "type": "market_data",
  "data": {
    "asset": "BTC",
    "price": 45100,
    "bid": 45095,
    "ask": 45105,
    "volume": 1250.5,
    "change24h": 2.5,
    "high24h": 45500,
    "low24h": 44500,
    "timestamp": "2024-01-01T12:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### `price_alert`
Triggered when price crosses predefined thresholds.

```json
{
  "type": "price_alert",
  "data": {
    "asset": "ETH",
    "price": 3000,
    "threshold": 2950,
    "direction": "above|below",
    "alertType": "resistance|support|custom"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Alert Events

#### `alert`
System alerts and notifications.

```json
{
  "type": "alert",
  "data": {
    "id": "alert_456",
    "level": "WARNING|ERROR|CRITICAL|INFO",
    "message": "High volatility detected in BTC market",
    "category": "market|system|risk|trading",
    "data": {
      "asset": "BTC",
      "volatility": 0.85,
      "threshold": 0.8
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Analytics Events

#### `analytics_update`
Dashboard and performance metric updates.

```json
{
  "type": "analytics_update",
  "data": {
    "portfolio": {
      "totalValue": 125000,
      "cash": 25000,
      "marginUsed": 100000,
      "positions": 5
    },
    "performance": {
      "totalTrades": 150,
      "winRate": 0.65,
      "totalPnL": 12500,
      "sharpeRatio": 1.8,
      "maxDrawdown": -5.2
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### `performance_update`
Detailed performance metrics update.

```json
{
  "type": "performance_update",
  "data": {
    "period": "daily|weekly|monthly",
    "metrics": {
      "totalReturn": 8.5,
      "volatility": 0.12,
      "sharpeRatio": 1.8,
      "maxDrawdown": -3.2,
      "winRate": 0.68,
      "avgWin": 250,
      "avgLoss": -180
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Risk Management Events

#### `risk_update`
Risk assessment and limit updates.

```json
{
  "type": "risk_update",
  "data": {
    "overallRisk": "MEDIUM|HIGH|CRITICAL",
    "riskFactors": [
      {
        "factor": "drawdown",
        "level": "MEDIUM",
        "current": -4.2,
        "threshold": -5.0
      },
      {
        "factor": "var",
        "level": "HIGH",
        "current": 8500,
        "threshold": 8000
      }
    ],
    "recommendations": [
      "Consider reducing position sizes",
      "Monitor BTC correlation closely"
    ]
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### `risk_limit_breached`
Triggered when risk limits are exceeded.

```json
{
  "type": "risk_limit_breached",
  "data": {
    "limitType": "drawdown|daily_loss|var|correlation",
    "currentValue": -6.5,
    "threshold": -5.0,
    "severity": "WARNING|CRITICAL",
    "action": "reduce_positions|stop_trading|notify_admin"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### System Events

#### `system_status`
System health and status updates.

```json
{
  "type": "system_status",
  "data": {
    "status": "healthy|degraded|critical",
    "components": {
      "tradingEngine": "active",
      "alertSystem": "active",
      "analyticsDashboard": "active",
      "riskManager": "active",
      "websocketServer": "active"
    },
    "uptime": 86400,
    "lastRestart": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### `connection_status`
WebSocket connection status updates.

```json
{
  "type": "connection_status",
  "data": {
    "status": "connected|disconnected|reconnecting",
    "clientId": "client_123",
    "uptime": 3600,
    "messageCount": 150
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Client Messages

### Authentication
```json
{
  "type": "auth",
  "data": {
    "apiKey": "your-api-key-here"
  }
}
```

### Subscription Management
```json
{
  "type": "subscribe",
  "data": {
    "events": ["trade_update", "alert", "market_data"]
  }
}
```

```json
{
  "type": "unsubscribe",
  "data": {
    "events": ["performance_update"]
  }
}
```

### Ping/Pong
```json
{
  "type": "ping",
  "data": {
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## Error Handling

### Error Message Format
```json
{
  "type": "error",
  "data": {
    "code": "AUTH_FAILED|INVALID_MESSAGE|RATE_LIMITED",
    "message": "Authentication failed",
    "details": "Invalid API key provided"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Common Error Codes
- `AUTH_FAILED`: Authentication failed
- `INVALID_MESSAGE`: Malformed message
- `RATE_LIMITED`: Too many messages
- `SUBSCRIPTION_FAILED`: Invalid subscription request
- `CONNECTION_ERROR`: Connection issues

## Best Practices

### Connection Management
1. Implement automatic reconnection with exponential backoff
2. Handle connection drops gracefully
3. Monitor connection health with ping/pong

### Message Handling
1. Parse messages safely with try/catch
2. Handle unknown message types gracefully
3. Implement message queuing for offline periods

### Performance
1. Subscribe only to needed events
2. Process messages asynchronously
3. Implement rate limiting on the client side

### Security
1. Use secure WebSocket (wss://) in production
2. Validate all incoming messages
3. Implement proper authentication

## Example Implementation

See [`websocket-example.js`](websocket-example.js) for a complete client implementation example.

## Rate Limits

- **Connection Limit**: 100 concurrent connections per IP
- **Message Rate**: 100 messages per second per connection
- **Subscription Limit**: 50 active subscriptions per connection

## Support

For WebSocket API support, please refer to the main API documentation or contact the development team.
