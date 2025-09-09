/**
 * Trading Engine Tests
 */

const { expect } = require('chai');
const TradingEngine = require('../src/tradingEngine');
const AlertSystem = require('../src/alertSystem');

describe('Trading Engine', function () {
    let tradingEngine;
    let alertSystem;
    const testConfig = {
        initialCash: 100000,
        maxPositionSize: 0.1,
        maxDrawdown: 0.2,
        stopLossPercent: 0.05,
        takeProfitPercent: 0.1,
        leverage: 1,
        minOrderSize: 10,
        maxOrdersPerAsset: 3
    };

    beforeEach(async function () {
        alertSystem = new AlertSystem({});
        tradingEngine = new TradingEngine(testConfig, alertSystem);
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    afterEach(function () {
        if (tradingEngine) {
            tradingEngine.cleanup();
        }
        if (alertSystem) {
            alertSystem.stopMonitoring();
        }
    });

    describe('Initialization', function () {
        it('should initialize with correct configuration', function () {
            expect(tradingEngine.config).to.deep.equal(testConfig);
            expect(tradingEngine.positions).to.be.an.instanceOf(Map);
            expect(tradingEngine.activeOrders).to.be.an.instanceOf(Map);
            expect(tradingEngine.portfolio.cash).to.equal(testConfig.initialCash);
        });

        it('should have correct trading parameters', function () {
            expect(tradingEngine.params.maxPositionSize).to.equal(testConfig.maxPositionSize);
            expect(tradingEngine.params.stopLossPercent).to.equal(testConfig.stopLossPercent);
            expect(tradingEngine.params.takeProfitPercent).to.equal(testConfig.takeProfitPercent);
        });
    });

    describe('Market Data Management', function () {
        it('should update market data correctly', function () {
            const marketData = {
                price: 100,
                bid: 99.5,
                ask: 100.5,
                volume: 1000,
                timestamp: new Date()
            };

            tradingEngine.updateMarketData('BTC', marketData);

            const storedData = tradingEngine.marketData.get('BTC');
            expect(storedData).to.deep.equal(marketData);
        });

        it('should maintain price history', function () {
            const data1 = { price: 100, volume: 1000 };
            const data2 = { price: 101, volume: 1100 };

            tradingEngine.updateMarketData('BTC', data1);
            tradingEngine.updateMarketData('BTC', data2);

            const history = tradingEngine.priceHistory.get('BTC');
            expect(history).to.be.an('array');
            expect(history.length).to.equal(2);
            expect(history[0].price).to.equal(100);
            expect(history[1].price).to.equal(101);
        });

        it('should limit price history size', function () {
            // Add more than maxHistoryPoints (1000) data points
            for (let i = 0; i < 1100; i++) {
                tradingEngine.updateMarketData('BTC', { price: 100 + i, volume: 1000 });
            }

            const history = tradingEngine.priceHistory.get('BTC');
            expect(history.length).to.be.at.most(1000);
        });
    });

    describe('Position Management', function () {
        beforeEach(function () {
            // Set up market data
            tradingEngine.updateMarketData('BTC', {
                price: 100,
                bid: 99.5,
                ask: 100.5,
                volume: 1000
            });
        });

        it('should open a long position', async function () {
            const position = await tradingEngine.openPosition('BTC', 'LONG', 100);

            expect(position).to.be.an('object');
            expect(position.asset).to.equal('BTC');
            expect(position.side).to.equal('LONG');
            expect(position.size).to.equal(100);
            expect(position.entryPrice).to.equal(100.5); // Ask price
            expect(position.status).to.equal('OPEN');
        });

        it('should open a short position', async function () {
            const position = await tradingEngine.openPosition('BTC', 'SHORT', 100);

            expect(position).to.be.an('object');
            expect(position.asset).to.equal('BTC');
            expect(position.side).to.equal('SHORT');
            expect(position.size).to.equal(100);
            expect(position.entryPrice).to.equal(99.5); // Bid price
            expect(position.status).to.equal('OPEN');
        });

        it('should calculate correct stop loss and take profit', async function () {
            const position = await tradingEngine.openPosition('BTC', 'LONG', 100);

            expect(position.stopLoss).to.equal(100.5 * (1 - testConfig.stopLossPercent));
            expect(position.takeProfit).to.equal(100.5 * (1 + testConfig.takeProfitPercent));
        });

        it('should close a position', async function () {
            const openPosition = await tradingEngine.openPosition('BTC', 'LONG', 100);
            const closedPosition = await tradingEngine.closePosition('BTC');

            expect(closedPosition).to.be.an('object');
            expect(closedPosition.status).to.equal('CLOSED');
            expect(closedPosition.exitPrice).to.be.a('number');
            expect(closedPosition.pnl).to.be.a('number');
            expect(closedPosition.exitTime).to.be.a('date');
        });

        it('should update portfolio after opening position', async function () {
            const initialCash = tradingEngine.portfolio.cash;
            await tradingEngine.openPosition('BTC', 'LONG', 100);

            expect(tradingEngine.portfolio.cash).to.be.lessThan(initialCash);
            expect(tradingEngine.portfolio.marginUsed).to.equal(100 * 100.5);
        });

        it('should update portfolio after closing position', async function () {
            const initialCash = tradingEngine.portfolio.cash;
            await tradingEngine.openPosition('BTC', 'LONG', 100);
            await tradingEngine.closePosition('BTC');

            expect(tradingEngine.portfolio.cash).to.not.equal(initialCash);
            expect(tradingEngine.portfolio.marginUsed).to.equal(0);
        });
    });

    describe('Risk Management', function () {
        beforeEach(function () {
            tradingEngine.updateMarketData('BTC', {
                price: 100,
                bid: 99.5,
                ask: 100.5,
                volume: 1000
            });
        });

        it('should check risk limits before opening position', async function () {
            // Test position size limit
            const largePosition = await tradingEngine.openPosition('BTC', 'LONG', 10000);
            expect(largePosition).to.be.null; // Should be rejected due to size limit
        });

        it('should calculate position size based on risk', function () {
            const size = tradingEngine.calculatePositionSize('BTC');
            expect(size).to.be.a('number');
            expect(size).to.be.at.least(testConfig.minOrderSize);
            expect(size).to.be.at.most(tradingEngine.portfolio.cash * testConfig.maxPositionSize / 100.5);
        });

        it('should check if position should be closed', async function () {
            await tradingEngine.openPosition('BTC', 'LONG', 100);

            // Update price to trigger stop loss
            tradingEngine.updateMarketData('BTC', {
                price: 90, // Below stop loss
                bid: 89.5,
                ask: 90.5,
                volume: 1000
            });

            const shouldClose = tradingEngine.shouldClosePosition('BTC', tradingEngine.positions.get('BTC'));
            expect(shouldClose).to.be.true;
        });

        it('should check if position should be closed for take profit', async function () {
            await tradingEngine.openPosition('BTC', 'LONG', 100);

            // Update price to trigger take profit
            tradingEngine.updateMarketData('BTC', {
                price: 115, // Above take profit
                bid: 114.5,
                ask: 115.5,
                volume: 1000
            });

            const shouldClose = tradingEngine.shouldClosePosition('BTC', tradingEngine.positions.get('BTC'));
            expect(shouldClose).to.be.true;
        });
    });

    describe('Trading Strategies', function () {
        beforeEach(function () {
            // Set up price history for technical indicators
            const prices = [];
            for (let i = 0; i < 50; i++) {
                prices.push({
                    price: 100 + Math.sin(i / 10) * 5,
                    volume: 1000 + Math.random() * 500
                });
            }

            prices.forEach(price => {
                tradingEngine.updateMarketData('BTC', price);
            });
        });

        it('should execute momentum strategy', async function () {
            const result = await tradingEngine.executeStrategy('BTC', 'momentum', 'BUY');
            expect(result).to.satisfy(val => val === null || typeof val === 'object');
        });

        it('should execute mean reversion strategy', async function () {
            const result = await tradingEngine.executeStrategy('BTC', 'mean_reversion', 'SELL');
            expect(result).to.satisfy(val => val === null || typeof val === 'object');
        });

        it('should execute breakout strategy', async function () {
            const result = await tradingEngine.executeStrategy('BTC', 'breakout', 'BUY');
            expect(result).to.satisfy(val => val === null || typeof val === 'object');
        });

        it('should handle unknown strategy', async function () {
            const result = await tradingEngine.executeStrategy('BTC', 'unknown_strategy', 'BUY');
            expect(result).to.be.null;
        });
    });

    describe('Technical Indicators', function () {
        beforeEach(function () {
            // Set up price history
            for (let i = 0; i < 50; i++) {
                tradingEngine.updateMarketData('BTC', {
                    price: 100 + i * 0.5,
                    volume: 1000
                });
            }
        });

        it('should calculate momentum', function () {
            const momentum = tradingEngine.calculateMomentum('BTC');
            expect(momentum).to.be.a('number');
            expect(momentum).to.be.within(-1, 1);
        });

        it('should calculate Z-score', function () {
            const zScore = tradingEngine.calculateZScore('BTC');
            expect(zScore).to.be.a('number');
        });

        it('should calculate RSI', function () {
            const rsi = tradingEngine.calculateRSI('BTC');
            expect(rsi).to.be.a('number');
            expect(rsi).to.be.within(0, 100);
        });

        it('should calculate volatility', function () {
            const volatility = tradingEngine.calculateVolatility('BTC');
            expect(volatility).to.be.a('number');
            expect(volatility).to.be.at.least(0);
        });

        it('should calculate trend', function () {
            const trend = tradingEngine.calculateTrend('BTC');
            expect(trend).to.be.a('number');
            expect([-1, 0, 1]).to.include(trend);
        });
    });

    describe('Performance Tracking', function () {
        it('should track performance metrics', async function () {
            // Open and close a position
            await tradingEngine.openPosition('BTC', 'LONG', 100);
            await tradingEngine.closePosition('BTC');

            const stats = tradingEngine.getStats();
            expect(stats.performance).to.be.an('object');
            expect(stats.performance.totalTrades).to.equal(1);
            expect(stats.performance.winningTrades).to.be.a('number');
            expect(stats.performance.losingTrades).to.be.a('number');
        });

        it('should calculate Sharpe ratio', function () {
            const sharpe = tradingEngine.performance.sharpeRatio;
            expect(sharpe).to.be.a('number');
        });

        it('should calculate win rate', function () {
            const winRate = tradingEngine.performance.winRate;
            expect(winRate).to.be.a('number');
            expect(winRate).to.be.within(0, 1);
        });
    });

    describe('Portfolio Management', function () {
        it('should calculate total portfolio value', function () {
            const totalValue = tradingEngine.calculateTotalValue();
            expect(totalValue).to.be.a('number');
            expect(totalValue).to.be.at.least(0);
        });

        it('should update portfolio value after position changes', async function () {
            const initialValue = tradingEngine.calculateTotalValue();

            await tradingEngine.openPosition('BTC', 'LONG', 100);
            const afterOpenValue = tradingEngine.calculateTotalValue();

            await tradingEngine.closePosition('BTC');
            const afterCloseValue = tradingEngine.calculateTotalValue();

            expect(afterOpenValue).to.not.equal(initialValue);
            expect(afterCloseValue).to.not.equal(afterOpenValue);
        });
    });

    describe('Monitoring and Maintenance', function () {
        it('should start monitoring', function () {
            tradingEngine.startMonitoring();
            expect(tradingEngine.monitoringInterval).to.not.be.null;
        });

        it('should stop monitoring', function () {
            tradingEngine.startMonitoring();
            expect(tradingEngine.monitoringInterval).to.not.be.null;

            tradingEngine.stopMonitoring();
            expect(tradingEngine.monitoringInterval).to.be.null;
        });

        it('should calculate drawdown', function () {
            const drawdown = tradingEngine.calculateDrawdown();
            expect(drawdown).to.be.a('number');
            expect(drawdown).to.be.within(0, 1);
        });
    });

    describe('Statistics and Reporting', function () {
        it('should provide comprehensive statistics', function () {
            const stats = tradingEngine.getStats();

            expect(stats).to.be.an('object');
            expect(stats).to.have.property('portfolio');
            expect(stats).to.have.property('performance');
            expect(stats).to.have.property('positions');
            expect(stats).to.have.property('activeOrders');

            expect(stats.portfolio).to.be.an('object');
            expect(stats.performance).to.be.an('object');
            expect(stats.positions).to.be.an('array');
            expect(stats.activeOrders).to.be.an('array');
        });

        it('should include portfolio information in stats', function () {
            const stats = tradingEngine.getStats();

            expect(stats.portfolio).to.have.property('totalValue');
            expect(stats.portfolio).to.have.property('cash');
            expect(stats.portfolio).to.have.property('marginUsed');
            expect(stats.portfolio).to.have.property('positions');
        });

        it('should include performance metrics in stats', function () {
            const stats = tradingEngine.getStats();

            expect(stats.performance).to.have.property('totalTrades');
            expect(stats.performance).to.have.property('winningTrades');
            expect(stats.performance).to.have.property('losingTrades');
            expect(stats.performance).to.have.property('totalPnL');
            expect(stats.performance).to.have.property('winRate');
        });
    });
});
