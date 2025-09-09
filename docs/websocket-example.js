/**
 * WebSocket Client Example
 * Demonstrates how to connect to the REChain Autonomous Agent WebSocket server
 * and handle real-time updates for trading activities, market data, and alerts.
 */

const WebSocket = require('ws');

// WebSocket server URL (adjust port if different)
const WS_URL = 'ws://localhost:3000';

class WebSocketClient {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000; // 5 seconds
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        console.log('Connecting to WebSocket server...');
        this.ws = new WebSocket(WS_URL);

        this.ws.on('open', () => {
            console.log('✅ Connected to WebSocket server');
            this.reconnectAttempts = 0;

            // Send authentication if required
            this.authenticate();
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(message);
            } catch (error) {
                console.error('❌ Error parsing WebSocket message:', error);
            }
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
        });

        this.ws.on('close', (code, reason) => {
            console.log(`🔌 WebSocket connection closed: ${code} - ${reason}`);
            this.handleReconnect();
        });
    }

    /**
     * Send authentication message (if required)
     */
    authenticate() {
        // If your server requires authentication, send auth message
        // const authMessage = {
        //     type: 'auth',
        //     apiKey: 'your-api-key-here'
        // };
        // this.ws.send(JSON.stringify(authMessage));
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(message) {
        console.log('📨 Received message:', message);

        switch (message.type) {
            case 'trade_update':
                this.handleTradeUpdate(message.data);
                break;
            case 'market_data':
                this.handleMarketData(message.data);
                break;
            case 'alert':
                this.handleAlert(message.data);
                break;
            case 'analytics':
                this.handleAnalytics(message.data);
                break;
            case 'risk_update':
                this.handleRiskUpdate(message.data);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    /**
     * Handle trade update messages
     */
    handleTradeUpdate(data) {
        console.log('📊 Trade Update:', data);
        // Process trade updates (position opens, closes, modifications)
        // Update your UI or perform actions based on trade changes
    }

    /**
     * Handle market data updates
     */
    handleMarketData(data) {
        console.log('💰 Market Data:', data);
        // Process market data updates (price changes, volume, etc.)
        // Update charts, indicators, or trading strategies
    }

    /**
     * Handle alert messages
     */
    handleAlert(data) {
        console.log('🚨 Alert:', data);
        // Process system alerts and notifications
        // Show notifications, log alerts, or trigger actions
    }

    /**
     * Handle analytics updates
     */
    handleAnalytics(data) {
        console.log('📈 Analytics:', data);
        // Process dashboard and performance metric updates
        // Update charts, KPIs, or performance indicators
    }

    /**
     * Handle risk management updates
     */
    handleRiskUpdate(data) {
        console.log('⚠️ Risk Update:', data);
        // Process risk assessment updates and limit breaches
        // Implement risk mitigation strategies if needed
    }

    /**
     * Handle reconnection logic
     */
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            setTimeout(() => {
                this.connect();
            }, this.reconnectInterval);
        } else {
            console.error('❌ Max reconnection attempts reached. Giving up.');
        }
    }

    /**
     * Send a message to the server
     */
    sendMessage(type, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                type,
                data,
                timestamp: new Date().toISOString()
            };
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('❌ WebSocket is not connected');
        }
    }

    /**
     * Subscribe to specific event types
     */
    subscribe(eventTypes) {
        this.sendMessage('subscribe', { events: eventTypes });
    }

    /**
     * Unsubscribe from specific event types
     */
    unsubscribe(eventTypes) {
        this.sendMessage('unsubscribe', { events: eventTypes });
    }

    /**
     * Close the WebSocket connection
     */
    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Usage example
function main() {
    const client = new WebSocketClient();

    // Connect to the server
    client.connect();

    // Example: Subscribe to specific events after connection
    setTimeout(() => {
        client.subscribe(['trade_update', 'alert', 'market_data']);
        console.log('📡 Subscribed to trade, alert, and market data events');
    }, 2000);

    // Example: Send a custom message
    setTimeout(() => {
        client.sendMessage('ping', { message: 'Hello from client!' });
    }, 5000);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('🛑 Shutting down...');
        client.close();
        process.exit(0);
    });
}

// Run the example if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = WebSocketClient;
