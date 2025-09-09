const WebSocket = require('ws');

class WebSocketServer {
    constructor(server, tradingEngine, alertSystem, analyticsDashboard, riskManager) {
        this.server = server;
        this.tradingEngine = tradingEngine;
        this.alertSystem = alertSystem;
        this.analyticsDashboard = analyticsDashboard;
        this.riskManager = riskManager;

        // Initialize WebSocket server if server is provided
        if (server) {
            this.wss = new WebSocket.Server({ server });
            this.setupConnectionHandler();
        }
    }

    /**
     * Start WebSocket server (for delayed initialization)
     */
    start(server) {
        if (!this.wss && server) {
            this.server = server;
            this.wss = new WebSocket.Server({ server });
            this.setupConnectionHandler();
            console.log('WebSocket server started');
        }
    }

    /**
     * Stop WebSocket server
     */
    stop() {
        if (this.wss) {
            this.wss.close();
            console.log('WebSocket server stopped');
        }
    }

    setupConnectionHandler() {
        this.wss.on('connection', (ws, req) => {
            const ip = req.socket.remoteAddress;
            console.log(`WebSocket connection established from ${ip}`);

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleMessage(ws, data);
                } catch (error) {
                    ws.send(JSON.stringify({ error: 'Invalid message format' }));
                }
            });

            ws.on('close', () => {
                console.log(`WebSocket connection closed from ${ip}`);
            });

            ws.on('error', (error) => {
                console.error(`WebSocket error from ${ip}:`, error);
            });
        });
    }

    async handleMessage(ws, data) {
        if (!data.type) {
            ws.send(JSON.stringify({ error: 'Message type is required' }));
            return;
        }

        switch (data.type) {
            case 'subscribe':
                this.handleSubscribe(ws, data);
                break;
            case 'unsubscribe':
                this.handleUnsubscribe(ws, data);
                break;
            case 'trade':
                await this.handleTrade(ws, data);
                break;
            default:
                ws.send(JSON.stringify({ error: `Unknown message type: ${data.type}` }));
        }
    }

    handleSubscribe(ws, data) {
        // Example: subscribe to market data or alerts
        ws.send(JSON.stringify({ success: true, message: `Subscribed to ${data.channel}` }));
    }

    handleUnsubscribe(ws, data) {
        // Example: unsubscribe from market data or alerts
        ws.send(JSON.stringify({ success: true, message: `Unsubscribed from ${data.channel}` }));
    }

    async handleTrade(ws, data) {
        try {
            const { asset, side, size } = data;
            if (!asset || !side || !size) {
                ws.send(JSON.stringify({ error: 'Missing required trade parameters: asset, side, size' }));
                return;
            }

            const mappedSide = side === 'BUY' ? 'LONG' : side === 'SELL' ? 'SHORT' : side;

            const result = await this.tradingEngine.openPosition(asset, mappedSide, size);

            if (result) {
                ws.send(JSON.stringify({
                    success: true,
                    trade: result,
                    message: `Successfully executed ${side} trade for ${asset}`
                }));
            } else {
                ws.send(JSON.stringify({ error: 'Trade execution failed' }));
            }
        } catch (error) {
            ws.send(JSON.stringify({ error: 'Trade execution error', details: error.message }));
        }
    }

    broadcast(data) {
        if (this.wss) {
            const message = JSON.stringify(data);
            this.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
    }

    close() {
        this.stop();
    }
}

module.exports = WebSocketServer;
