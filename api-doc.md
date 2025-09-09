# API Documentation

Comprehensive API documentation for the REChain Autonomous Agent for Pythagorean Perpetual Futures.

## 📋 Overview

The agent provides a RESTful API for monitoring, administration, and trading operations. All endpoints require authentication unless otherwise specified.

## 🔐 Authentication

### API Key Authentication
Most endpoints require an API key sent in the `x-api-key` header:

```bash
curl -H "x-api-key: your-api-key" http://localhost:3000/api/endpoint
```

### Admin Authentication
Admin endpoints require an admin token in the `x-admin-token` header:

```bash
curl -H "x-admin-token: your-admin-token" http://localhost:3000/admin/endpoint
```

### Web3 Authentication
For wallet-based authentication:

1. Get a nonce: `GET /web3/nonce`
2. Sign the message containing the nonce
3. Verify signature: `POST /web3/verify`

## 🌐 Base URL
All endpoints are relative to the base URL: `http://localhost:3000` (or your configured domain)

## 📊 Core Endpoints

### Health & Status

#### GET /healthz
**Description**: Liveness probe endpoint
**Authentication**: None
**Response**: 200 OK

#### GET /readyz  
**Description**: Readiness probe endpoint
**Authentication**: None
**Response**: 200 OK

#### GET /metrics/status
**Description**: Get operational status metrics
**Authentication**: API key required
**Response**: JSON object with status information

#### GET /metrics/positions
**Description**: Get current position exposure breakdown
**Authentication**: API key required
**Response**: JSON array of position objects

#### GET /metrics/performance
**Description**: Get historical performance and PnL summary
**Authentication**: API key required
**Response**: JSON object with performance metrics

### Real-time Streaming

#### GET /metrics/stream
**Description**: Server-Sent Events stream for real-time metrics
**Authentication**: API key required
**Events**: 
- `metrics`: Emitted every 5 seconds with current metrics
- `rebalance`: Emitted when rebalancing occurs
- `error`: Emitted on errors

**Example Client Code**:
```javascript
const eventSource = new EventSource('/metrics/stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Metrics update:', data);
};
```

## ⚙️ Admin Endpoints

### Webhook Management

#### POST /admin/hooks
**Description**: Register a new webhook
**Authentication**: Admin token required
**Body**:
```json
{
  "url": "https://your-webhook-endpoint.com"
}
```
**Response**: 201 Created with webhook details

#### DELETE /admin/hooks
**Description**: Remove a webhook
**Authentication**: Admin token required
**Body**:
```json
{
  "url": "https://your-webhook-endpoint.com"
}
```
**Response**: 200 OK

#### GET /admin/hooks
**Description**: List all registered webhooks
**Authentication**: Admin token required
**Response**: JSON array of webhook objects

### Metrics Management

#### POST /admin/refresh-metrics
**Description**: Manually refresh metrics (if provider supports refresh)
**Authentication**: Admin token required
**Response**: 200 OK

#### POST /admin/update-metrics
**Description**: Update metrics (file/stub providers)
**Authentication**: Admin token required
**Response**: 200 OK

### Event Management

#### POST /admin/emit
**Description**: Emit a custom event
**Authentication**: Admin token required
**Body**:
```json
{
  "event": "custom.event.name",
  "payload": {"key": "value"}
}
```
**Response**: 200 OK

### Configuration & Sessions

#### GET /admin/config
**Description**: Safe configuration view (sensitive data redacted)
**Authentication**: Admin token required
**Response**: JSON configuration object

#### GET /admin/sessions
**Description**: List active sessions with metadata
**Authentication**: Admin token required
**Response**: JSON array of session objects

#### DELETE /admin/sessions
**Description**: Remove a session
**Authentication**: Admin token required
**Body**:
```json
{
  "sessionId": "session-id-to-remove"
}
```
**Response**: 200 OK

#### POST /admin/elevate
**Description**: Grant admin role to a session
**Authentication**: Admin token required
**Body**:
```json
{
  "sessionId": "session-id-to-elevate"
}
```
**Response**: 200 OK with updated session details

## 🔐 Authentication Endpoints

### Web3 Authentication

#### GET /web3/nonce
**Description**: Generate a nonce for wallet authentication
**Authentication**: None
**Response**:
```json
{
  "id": "unique-request-id",
  "nonce": "random-nonce-string"
}
```

#### POST /web3/verify
**Description**: Verify wallet signature and create session
**Authentication**: None
**Body**:
```json
{
  "id": "request-id-from-nonce",
  "address": "0xWalletAddress",
  "signature": "signature-string",
  "message": "message-containing-nonce"
}
```
**Response**:
```json
{
  "sessionId": "generated-session-id",
  "exp": "expiration-timestamp"
}
```

### DID Authentication (Stub)

#### POST /did/verify
**Description**: DID authentication stub (for testing)
**Authentication**: None
**Body**:
```json
{
  "did": "did:example:123",
  "proof": "stub-proof"
}
```
**Response**:
```json
{
  "sessionId": "generated-session-id",
  "exp": "expiration-timestamp"
}
```

## 📡 Webhook Events

The agent emits various events that can be sent to registered webhooks:

### Event Types

- **rebalance**: Position rebalancing occurred
- **metrics.update**: Metrics were updated
- **metrics.refresh**: Metrics were manually refreshed
- **auth.web3**: Web3 authentication succeeded
- **auth.did**: DID authentication succeeded
- **metrics.tick**: Periodic metrics tick (enable with `WEBHOOK_ON_TICK=true`)

### Webhook Security

Webhook requests include security headers:

- `x-signature: sha256=<hmac>` - HMAC signature
- `x-id`: Unique identifier for deduplication
- `x-ts`: Timestamp for validation

**Signature Calculation**:
```javascript
const hmac = HMAC_SHA256(WEBHOOK_SECRET, x-id + x-ts + body)
```

### Webhook Configuration

Environment variables for webhook configuration:

- `WEBHOOK_SECRET`: Secret for signature validation
- `WEBHOOK_MAX_RETRIES`: Maximum retry attempts (default: 3)
- `WEBHOOK_RETRY_DELAY_MS`: Retry delay in milliseconds
- `WEBHOOK_ON_TICK`: Enable tick events (default: false)

## 🚦 Rate Limiting

The API implements rate limiting to prevent abuse:

- General endpoints: 100 requests per minute
- Admin endpoints: 20 requests per minute
- Authentication endpoints: 10 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when limit resets

## 🐛 Error Responses

Standard error response format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes

- `UNAUTHORIZED`: Authentication required or invalid
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `RATE_LIMITED`: Rate limit exceeded
- `VALIDATION_ERROR`: Invalid request data
- `INTERNAL_ERROR`: Server error

## 🔄 API Versioning

The API follows semantic versioning. Current version: `v0.1.0`

Version can be specified in the `Accept` header:
```
Accept: application/vnd.pythagorean-agent.v0.1.0+json
```

## 📋 Response Formats

All successful responses return JSON with consistent structure:

```json
{
  "data": {
    // Endpoint-specific data
  },
  "meta": {
    "timestamp": "2023-01-01T00:00:00Z",
    "version": "0.1.0"
  }
}
```

## 🔍 OpenAPI Specification

For complete API specification, see [`openapi.yaml`](../openapi.yaml) or visit `/docs` when the server is running.

The OpenAPI spec provides:
- Interactive API documentation
- Request/response schemas
- Authentication requirements
- Error responses
- Example requests

## 🛠️ Client Libraries

### JavaScript/TypeScript

```javascript
import { PythagoreanAgentClient } from 'pythagorean-agent-client';

const client = new PythagoreanAgentClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Example usage
const metrics = await client.getMetrics();
```

### Python

```python
from pythagorean_agent import Client

client = Client(
    base_url="http://localhost:3000",
    api_key="your-api-key"
)

metrics = client.get_metrics()
```

## 📞 Support

For API-related issues:
- Check the OpenAPI documentation at `/docs`
- Review server logs for error details
- Test endpoints with curl or Postman
- Create issues on GitHub for bugs or feature requests

**Note**: This documentation is for version 0.1.0 of the API. Check for updates in future releases.