/**
 * API Endpoints Tests
 */

const { expect } = require('chai');
const request = require('supertest');
const AutonomousAgent = require('../src/main');

describe('API Endpoints', function () {
    let agent;
    let server;
    let testApp;

    const testConfig = {
        port: 3001, // Use different port for testing
        apiKey: 'test-api-key',
        corsOrigins: ['http://localhost:3001'],
        initialCash: 100000,
        maxPositionSize: 0.1,
        maxDrawdown: 0.2,
        stopLossPercent: 0.05,
        takeProfitPercent: 0.1,
        leverage: 1,
        minOrderSize: 10,
        maxOrdersPerAsset: 3
    };

    before(async function () {
        // Increase timeout for initialization
        this.timeout(10000);

        agent = new AutonomousAgent(testConfig);
        await agent.initialize();
        await agent.start();

        // Get the express app from the server component
        testApp = agent.components.server.app;
    });

    after(async function () {
        if (agent) {
            await agent.stop();
        }
    });

    describe('Health Check', function () {
        it('should return health status', async function () {
            const response = await request(testApp)
                .get('/health')
                .expect(200);

            expect(response.body).to.be.an('object');
            expect(response.body).to.have.property('status', 'healthy');
            expect(response.body).to.have.property('uptime');
            expect(response.body).to.have.property('version');
            expect(response.body).to.have.property('components');
        });
    });

    describe('Authentication', function () {
        it('should accept valid API key', async function () {
            const response = await request(testApp)
                .get('/api/positions')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.be.an('object');
        });

        it('should reject invalid API key', async function () {
            const response = await request(testApp)
                .get('/api/positions')
                .set('x-api-key', 'invalid-key')
                .expect(401);

            expect(response.body).to.have.property('error', 'Invalid API key');
        });

        it('should accept API key in query parameter', async function () {
            const response = await request(testApp)
                .get('/api/positions?apiKey=test-api-key')
                .expect(200);

            expect(response.body).to.be.an('object');
        });
    });

    describe('Trading Endpoints', function () {
        beforeEach(async function () {
            // Set up some market data
            await request(testApp)
                .post('/api/market')
                .set('x-api-key', 'test-api-key')
                .send([{
                    asset: 'BTC',
                    price: 100,
                    bid: 99.5,
                    ask: 100.5,
                    volume: 1000
                }])
                .expect(200);
        });

        it('should execute a trade', async function () {
            const response = await request(testApp)
                .post('/api/trade')
                .set('x-api-key', 'test-api-key')
                .send({
                    asset: 'BTC',
                    side: 'BUY',
                    size: 100,
                    strategy: 'momentum'
                })
                .expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('trade');
            expect(response.body.trade).to.have.property('asset', 'BTC');
            expect(response.body.trade).to.have.property('side', 'LONG');
        });

        it('should reject trade without required parameters', async function () {
            const response = await request(testApp)
                .post('/api/trade')
                .set('x-api-key', 'test-api-key')
                .send({
                    asset: 'BTC'
                    // Missing side and size
                })
                .expect(400);

            expect(response.body).to.have.property('error');
        });

        it('should get positions', async function () {
            // First create a position
            await request(testApp)
                .post('/api/trade')
                .set('x-api-key', 'test-api-key')
                .send({
                    asset: 'BTC',
                    side: 'BUY',
                    size: 50
                });

            const response = await request(testApp)
                .get('/api/positions')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.have.property('positions');
            expect(response.body).to.have.property('summary');
            expect(response.body.positions).to.be.an('array');
            expect(response.body.summary).to.have.property('totalPositions');
        });

        it('should close a position', async function () {
            // First create a position
            await request(testApp)
                .post('/api/trade')
                .set('x-api-key', 'test-api-key')
                .send({
                    asset: 'BTC',
                    side: 'BUY',
                    size: 50
                });

            const response = await request(testApp)
                .delete('/api/positions/BTC')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('closedPosition');
        });

        it('should return 404 for non-existent position', async function () {
            const response = await request(testApp)
                .delete('/api/positions/NONEXISTENT')
                .set('x-api-key', 'test-api-key')
                .expect(404);

            expect(response.body).to.have.property('error');
        });
    });

    describe('Market Data Endpoints', function () {
        it('should update market data', async function () {
            const marketData = [{
                asset: 'ETH',
                price: 2000,
                bid: 1990,
                ask: 2010,
                volume: 5000
            }];

            const response = await request(testApp)
                .post('/api/market')
                .set('x-api-key', 'test-api-key')
                .send(marketData)
                .expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('updated', 1);
        });

        it('should reject invalid market data', async function () {
            const response = await request(testApp)
                .post('/api/market')
                .set('x-api-key', 'test-api-key')
                .send("invalid data")
                .expect(400);

            expect(response.body).to.have.property('error');
        });

        it('should get market data for asset', async function () {
            // First update market data
            await request(testApp)
                .post('/api/market')
                .set('x-api-key', 'test-api-key')
                .send([{
                    asset: 'ADA',
                    price: 0.5,
                    bid: 0.49,
                    ask: 0.51,
                    volume: 10000
                }]);

            const response = await request(testApp)
                .get('/api/market/ADA')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.have.property('price', 0.5);
            expect(response.body).to.have.property('bid', 0.49);
            expect(response.body).to.have.property('ask', 0.51);
        });

        it('should return 404 for unknown asset', async function () {
            const response = await request(testApp)
                .get('/api/market/UNKNOWN')
                .set('x-api-key', 'test-api-key')
                .expect(404);

            expect(response.body).to.have.property('error');
        });
    });

    describe('Analytics Endpoints', function () {
        it('should get dashboard data', async function () {
            const response = await request(testApp)
                .get('/api/analytics/dashboard')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.be.an('object');
            expect(response.body).to.have.property('portfolio');
            expect(response.body).to.have.property('performance');
            expect(response.body).to.have.property('risk');
            expect(response.body).to.have.property('market');
        });

        it('should get performance data', async function () {
            const response = await request(testApp)
                .get('/api/analytics/performance')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.be.an('object');
            expect(response.body).to.have.property('totalTrades');
            expect(response.body).to.have.property('winRate');
        });

        it('should get chart data', async function () {
            const response = await request(testApp)
                .get('/api/analytics/chart/portfolio')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.be.an('object');
            expect(response.body).to.have.property('labels');
            expect(response.body).to.have.property('data');
        });

        it('should return 404 for unknown chart type', async function () {
            const response = await request(testApp)
                .get('/api/analytics/chart/unknown')
                .set('x-api-key', 'test-api-key')
                .expect(404);

            expect(response.body).to.have.property('error');
        });
    });

    describe('Risk Management Endpoints', function () {
        it('should get risk assessment', async function () {
            const response = await request(testApp)
                .get('/api/risk/assessment')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.be.an('object');
            expect(response.body).to.have.property('overallRisk');
            expect(response.body).to.have.property('riskFactors');
            expect(response.body).to.have.property('recommendations');
        });

        it('should get risk limits', async function () {
            const response = await request(testApp)
                .get('/api/risk/limits')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.be.an('object');
            expect(response.body).to.have.property('drawdown');
            expect(response.body).to.have.property('dailyLoss');
            expect(response.body).to.have.property('var');
        });

        it('should trigger emergency stop', async function () {
            const response = await request(testApp)
                .post('/api/risk/emergency-stop')
                .set('x-api-key', 'test-api-key')
                .send({ reason: 'Test emergency stop' })
                .expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('message');
        });
    });

    describe('Alert System Endpoints', function () {
        it('should get alerts', async function () {
            const response = await request(testApp)
                .get('/api/alerts')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.be.an('object');
            expect(response.body).to.have.property('alerts');
            expect(response.body).to.have.property('total');
            expect(response.body.alerts).to.be.an('array');
        });

        it('should filter alerts by level', async function () {
            const response = await request(testApp)
                .get('/api/alerts?level=ERROR')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body.alerts).to.be.an('array');
            // All returned alerts should be ERROR level
            response.body.alerts.forEach(alert => {
                expect(alert.level).to.equal('ERROR');
            });
        });

        it('should get alert statistics', async function () {
            const response = await request(testApp)
                .get('/api/alerts/stats')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.be.an('object');
            expect(response.body).to.have.property('total');
            expect(response.body).to.have.property('byLevel');
            expect(response.body).to.have.property('recent');
        });
    });

    describe('Strategy Endpoints', function () {
        it('should get available strategies', async function () {
            const response = await request(testApp)
                .get('/api/strategies')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.have.property('strategies');
            expect(response.body.strategies).to.be.an('array');
            expect(response.body.strategies.length).to.be.greaterThan(0);

            // Check strategy structure
            const strategy = response.body.strategies[0];
            expect(strategy).to.have.property('name');
            expect(strategy).to.have.property('description');
            expect(strategy).to.have.property('parameters');
        });

        it('should execute a strategy', async function () {
            const response = await request(testApp)
                .post('/api/strategies/momentum')
                .set('x-api-key', 'test-api-key')
                .send({
                    asset: 'BTC',
                    signal: 'BUY'
                })
                .expect(200);

            expect(response.body).to.have.property('success');
            expect(response.body).to.have.property('strategy', 'momentum');
        });

        it('should reject strategy execution without required parameters', async function () {
            const response = await request(testApp)
                .post('/api/strategies/momentum')
                .set('x-api-key', 'test-api-key')
                .send({
                    asset: 'BTC'
                    // Missing signal
                })
                .expect(400);

            expect(response.body).to.have.property('error');
        });
    });

    describe('Configuration Endpoints', function () {
        it('should get configuration', async function () {
            const response = await request(testApp)
                .get('/api/config')
                .set('x-api-key', 'test-api-key')
                .expect(200);

            expect(response.body).to.be.an('object');
            expect(response.body).to.have.property('server');
            expect(response.body).to.have.property('trading');
            expect(response.body).to.have.property('risk');
        });

        it('should update configuration', async function () {
            const updates = {
                refreshInterval: 10000,
                maxHistoryPoints: 2000
            };

            const response = await request(testApp)
                .put('/api/config')
                .set('x-api-key', 'test-api-key')
                .send(updates)
                .expect(200);

            expect(response.body).to.have.property('success', true);
            expect(response.body).to.have.property('updated');
        });

        it('should reject invalid configuration keys', async function () {
            const response = await request(testApp)
                .put('/api/config')
                .set('x-api-key', 'test-api-key')
                .send({
                    invalidKey: 'value'
                })
                .expect(400);

            expect(response.body).to.have.property('error');
        });
    });

    describe('Error Handling', function () {
        it('should handle 404 errors', async function () {
            const response = await request(testApp)
                .get('/api/nonexistent')
                .set('x-api-key', 'test-api-key')
                .expect(404);

            expect(response.body).to.have.property('error', 'Endpoint not found');
        });

        it('should handle method not allowed', async function () {
            const response = await request(testApp)
                .patch('/api/positions')
                .set('x-api-key', 'test-api-key')
                .expect(404);

            expect(response.body).to.have.property('error', 'Endpoint not found');
        });
    });

    describe('Rate Limiting', function () {
        it('should handle rate limiting gracefully', async function () {
            // This test might be skipped if rate limiting is not strictly enforced in test environment
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    request(testApp)
                        .get('/health')
                        .set('x-api-key', 'test-api-key')
                );
            }

            const responses = await Promise.all(promises);
            const successCount = responses.filter(r => r.status === 200).length;
            const rateLimitCount = responses.filter(r => r.status === 429).length;

            expect(successCount + rateLimitCount).to.equal(10);
        });
    });

    describe('CORS', function () {
        it('should include CORS headers', async function () {
            const response = await request(testApp)
                .options('/health')
                .expect(200);

            expect(response.headers).to.have.property('access-control-allow-origin');
            expect(response.headers).to.have.property('access-control-allow-methods');
            expect(response.headers).to.have.property('access-control-allow-headers');
        });
    });
});
