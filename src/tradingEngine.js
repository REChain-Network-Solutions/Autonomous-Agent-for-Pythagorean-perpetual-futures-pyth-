/**
 * Enhanced Trading Engine
 * Implements advanced trading strategies, position management, and risk controls
 */

const EventEmitter = require('events');

class TradingEngine extends EventEmitter {
    constructor(config, alertSystem) {
        super();
        this.config = config;
        this.alertSystem = alertSystem;
        this.positions = new Map();
        this.activeOrders = new Map();
        this.portfolio = {
            totalValue: 0,
            positions: {},
            cash: config.initialCash || 100000,
            marginUsed: 0
        };

        // Trading parameters
        this.params = {
            maxPositionSize: config.maxPositionSize || 0.1, // 10% of portfolio
            maxDrawdown: config.maxDrawdown || 0.2, // 20% max drawdown
            stopLossPercent: config.stopLossPercent || 0.05, // 5% stop loss
            takeProfitPercent: config.takeProfitPercent || 0.1, // 10% take profit
            leverage: config.leverage || 1,
            minOrderSize: config.minOrderSize || 10,
            maxOrdersPerAsset: config.maxOrdersPerAsset || 3
        };

        // Market data cache
        this.marketData = new Map();
        this.priceHistory = new Map();

        // Performance tracking
        this.performance = {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            winRate: 0
        };

        this.initialize();
    }

    /**
     * Initialize trading engine
     */
    async initialize() {
        await this.alertSystem.logAlert('INFO', 'Trading Engine initialized', {
            params: this.params,
            portfolio: this.portfolio
        });

        // Start monitoring
        this.startMonitoring();
    }

    /**
     * Execute trading strategy
     */
    async executeStrategy(asset, strategy, signal) {
        try {
            const position = this.positions.get(asset);
            const marketData = this.marketData.get(asset);

            if (!marketData) {
                await this.alertSystem.logAlert('WARNING', `No market data available for ${asset}`);
                return;
            }

            switch (strategy) {
                case 'momentum':
                    return await this.executeMomentumStrategy(asset, signal);
                case 'mean_reversion':
                    return await this.executeMeanReversionStrategy(asset, signal);
                case 'breakout':
                    return await this.executeBreakoutStrategy(asset, signal);
                case 'scalping':
                    return await this.executeScalpingStrategy(asset, signal);
                case 'swing':
                    return await this.executeSwingStrategy(asset, signal);
                default:
                    await this.alertSystem.logAlert('ERROR', `Unknown strategy: ${strategy}`);
                    return;
            }
        } catch (error) {
            await this.alertSystem.logError(error, { asset, strategy, signal });
        }
    }

    /**
     * Execute momentum strategy
     */
    async executeMomentumStrategy(asset, signal) {
        const marketData = this.marketData.get(asset);
        const position = this.positions.get(asset);

        // Calculate momentum indicators
        const momentum = this.calculateMomentum(asset);
        const volume = this.calculateVolumeTrend(asset);

        if (signal === 'BUY' && momentum > 0.7 && volume > 0.6) {
            return await this.openPosition(asset, 'LONG', this.calculatePositionSize(asset));
        } else if (signal === 'SELL' && momentum < -0.7 && volume > 0.6) {
            return await this.openPosition(asset, 'SHORT', this.calculatePositionSize(asset));
        } else if (position && this.shouldClosePosition(asset, position)) {
            return await this.closePosition(asset);
        }
    }

    /**
     * Execute mean reversion strategy
     */
    async executeMeanReversionStrategy(asset, signal) {
        const marketData = this.marketData.get(asset);
        const position = this.positions.get(asset);

        // Calculate mean reversion indicators
        const zScore = this.calculateZScore(asset);
        const rsi = this.calculateRSI(asset);

        if (signal === 'BUY' && zScore < -2 && rsi < 30) {
            return await this.openPosition(asset, 'LONG', this.calculatePositionSize(asset));
        } else if (signal === 'SELL' && zScore > 2 && rsi > 70) {
            return await this.openPosition(asset, 'SHORT', this.calculatePositionSize(asset));
        } else if (position && Math.abs(zScore) < 0.5) {
            return await this.closePosition(asset);
        }
    }

    /**
     * Execute breakout strategy
     */
    async executeBreakoutStrategy(asset, signal) {
        const marketData = this.marketData.get(asset);
        const position = this.positions.get(asset);

        // Calculate breakout indicators
        const breakoutLevel = this.calculateBreakoutLevel(asset);
        const currentPrice = marketData.price;

        if (signal === 'BUY' && currentPrice > breakoutLevel.upper) {
            return await this.openPosition(asset, 'LONG', this.calculatePositionSize(asset));
        } else if (signal === 'SELL' && currentPrice < breakoutLevel.lower) {
            return await this.openPosition(asset, 'SHORT', this.calculatePositionSize(asset));
        }
    }

    /**
     * Execute scalping strategy
     */
    async executeScalpingStrategy(asset, signal) {
        const marketData = this.marketData.get(asset);
        const position = this.positions.get(asset);

        // Quick entries and exits based on small price movements
        const tickSize = this.calculateTickSize(asset);
        const spread = marketData.ask - marketData.bid;

        if (signal === 'BUY' && spread < tickSize * 2) {
            return await this.openPosition(asset, 'LONG', this.calculatePositionSize(asset) * 0.5);
        } else if (signal === 'SELL' && spread < tickSize * 2) {
            return await this.openPosition(asset, 'SHORT', this.calculatePositionSize(asset) * 0.5);
        } else if (position && this.checkScalpExit(asset, position)) {
            return await this.closePosition(asset);
        }
    }

    /**
     * Execute swing strategy
     */
    async executeSwingStrategy(asset, signal) {
        const marketData = this.marketData.get(asset);
        const position = this.positions.get(asset);

        // Longer-term trend following
        const trend = this.calculateTrend(asset);
        const support = this.calculateSupportLevel(asset);
        const resistance = this.calculateResistanceLevel(asset);

        if (signal === 'BUY' && trend > 0 && marketData.price > support) {
            return await this.openPosition(asset, 'LONG', this.calculatePositionSize(asset));
        } else if (signal === 'SELL' && trend < 0 && marketData.price < resistance) {
            return await this.openPosition(asset, 'SHORT', this.calculatePositionSize(asset));
        }
    }

    /**
     * Open a new position
     */
    async openPosition(asset, side, size) {
        try {
            // Check risk limits
            if (!this.checkRiskLimits(asset, size)) {
                await this.alertSystem.logAlert('WARNING', `Risk limit exceeded for ${asset}`);
                return null;
            }

            const marketData = this.marketData.get(asset);
            const entryPrice = side === 'LONG' ? marketData.ask : marketData.bid;
            const positionValue = size * entryPrice;

            // Check available margin/cash
            if (positionValue > this.portfolio.cash) {
                await this.alertSystem.logAlert('WARNING', `Insufficient funds for ${asset} position`);
                return null;
            }

            const position = {
                id: this.generatePositionId(),
                asset,
                side,
                size,
                entryPrice,
                entryTime: new Date(),
                stopLoss: this.calculateStopLoss(entryPrice, side),
                takeProfit: this.calculateTakeProfit(entryPrice, side),
                status: 'OPEN',
                pnl: 0,
                fees: this.calculateFees(positionValue)
            };

            this.positions.set(asset, position);
            this.portfolio.cash -= positionValue + position.fees;
            this.portfolio.marginUsed += positionValue;

            await this.alertSystem.logAlert('INFO', `Opened ${side} position for ${asset}`, position);

            this.emit('positionOpened', position);
            return position;

        } catch (error) {
            await this.alertSystem.logError(error, { asset, side, size });
            return null;
        }
    }

    /**
     * Close an existing position
     */
    async closePosition(asset) {
        try {
            const position = this.positions.get(asset);
            if (!position) {
                await this.alertSystem.logAlert('WARNING', `No position found for ${asset}`);
                return null;
            }

            const marketData = this.marketData.get(asset);
            const exitPrice = position.side === 'LONG' ? marketData.bid : marketData.ask;
            const exitValue = position.size * exitPrice;

            // Calculate P&L
            const pnl = position.side === 'LONG'
                ? (exitValue - position.size * position.entryPrice)
                : (position.size * position.entryPrice - exitValue);

            position.exitPrice = exitPrice;
            position.exitTime = new Date();
            position.pnl = pnl - position.fees;
            position.status = 'CLOSED';

            // Update portfolio
            this.portfolio.cash += exitValue - position.fees;
            this.portfolio.marginUsed -= position.size * position.entryPrice;
            this.portfolio.totalValue = this.calculateTotalValue();

            // Update performance
            this.updatePerformance(position);

            this.positions.delete(asset);

            await this.alertSystem.logAlert('INFO', `Closed ${position.side} position for ${asset}`, {
                pnl: position.pnl,
                totalPnL: this.performance.totalPnL
            });

            this.emit('positionClosed', position);
            return position;

        } catch (error) {
            await this.alertSystem.logError(error, { asset });
            return null;
        }
    }

    /**
     * Calculate position size based on risk management
     */
    calculatePositionSize(asset) {
        const marketData = this.marketData.get(asset);
        const volatility = this.calculateVolatility(asset);
        const riskAmount = this.portfolio.cash * this.params.maxPositionSize;

        // Kelly Criterion or similar risk-based sizing
        const riskPerTrade = this.params.stopLossPercent;
        const positionSize = riskAmount / (marketData.price * riskPerTrade);

        // Adjust for volatility
        const adjustedSize = positionSize * (1 - volatility);

        return Math.max(this.params.minOrderSize, Math.min(adjustedSize, riskAmount / marketData.price));
    }

    /**
     * Calculate stop loss price
     */
    calculateStopLoss(entryPrice, side) {
        const stopDistance = entryPrice * this.params.stopLossPercent;
        return side === 'LONG' ? entryPrice - stopDistance : entryPrice + stopDistance;
    }

    /**
     * Calculate take profit price
     */
    calculateTakeProfit(entryPrice, side) {
        const profitDistance = entryPrice * this.params.takeProfitPercent;
        return side === 'LONG' ? entryPrice + profitDistance : entryPrice - profitDistance;
    }

    /**
     * Check if position should be closed
     */
    shouldClosePosition(asset, position) {
        const marketData = this.marketData.get(asset);
        const currentPrice = marketData.price;

        // Check stop loss
        if (position.side === 'LONG' && currentPrice <= position.stopLoss) {
            return true;
        }
        if (position.side === 'SHORT' && currentPrice >= position.stopLoss) {
            return true;
        }

        // Check take profit
        if (position.side === 'LONG' && currentPrice >= position.takeProfit) {
            return true;
        }
        if (position.side === 'SHORT' && currentPrice <= position.takeProfit) {
            return true;
        }

        return false;
    }

    /**
     * Check risk limits
     */
    checkRiskLimits(asset, size) {
        const marketData = this.marketData.get(asset);
        const positionValue = size * marketData.price;

        // Check position size limit
        if (positionValue > this.portfolio.cash * this.params.maxPositionSize) {
            return false;
        }

        // Check margin usage
        if (this.portfolio.marginUsed + positionValue > this.portfolio.cash * this.params.leverage) {
            return false;
        }

        // Check max orders per asset
        const assetOrders = Array.from(this.activeOrders.values())
            .filter(order => order.asset === asset).length;
        if (assetOrders >= this.params.maxOrdersPerAsset) {
            return false;
        }

        return true;
    }

    /**
     * Update market data
     */
    updateMarketData(asset, data) {
        this.marketData.set(asset, {
            ...data,
            timestamp: new Date()
        });

        // Update price history
        if (!this.priceHistory.has(asset)) {
            this.priceHistory.set(asset, []);
        }

        const history = this.priceHistory.get(asset);
        history.push({
            price: data.price,
            volume: data.volume,
            timestamp: new Date()
        });

        // Keep only last 1000 data points
        if (history.length > 1000) {
            history.shift();
        }

        // Check for position updates
        const position = this.positions.get(asset);
        if (position) {
            this.checkPositionUpdates(asset, position);
        }
    }

    /**
     * Check for position updates (stop loss, take profit, etc.)
     */
    async checkPositionUpdates(asset, position) {
        if (this.shouldClosePosition(asset, position)) {
            await this.closePosition(asset);
        }
    }

    /**
     * Calculate total portfolio value
     */
    calculateTotalValue() {
        let totalValue = this.portfolio.cash;

        for (const [asset, position] of this.positions) {
            const marketData = this.marketData.get(asset);
            if (marketData) {
                const positionValue = position.size * marketData.price;
                totalValue += positionValue;
            }
        }

        return totalValue;
    }

    /**
     * Update performance metrics
     */
    updatePerformance(position) {
        this.performance.totalTrades++;
        this.performance.totalPnL += position.pnl;

        if (position.pnl > 0) {
            this.performance.winningTrades++;
        } else {
            this.performance.losingTrades++;
        }

        this.performance.winRate = this.performance.winningTrades / this.performance.totalTrades;

        // Calculate Sharpe ratio (simplified)
        this.performance.sharpeRatio = this.calculateSharpeRatio();
    }

    /**
     * Calculate Sharpe ratio
     */
    calculateSharpeRatio() {
        // Simplified Sharpe ratio calculation
        const returns = [];
        // This would require historical return data
        return returns.length > 0 ? this.calculateAverage(returns) / this.calculateStdDev(returns) : 0;
    }

    /**
     * Technical indicators
     */
    calculateMomentum(asset) {
        const history = this.priceHistory.get(asset);
        if (!history || history.length < 20) return 0;

        const recent = history.slice(-10);
        const older = history.slice(-20, -10);

        const recentAvg = this.calculateAverage(recent.map(h => h.price));
        const olderAvg = this.calculateAverage(older.map(h => h.price));

        return (recentAvg - olderAvg) / olderAvg;
    }

    calculateZScore(asset) {
        const history = this.priceHistory.get(asset);
        if (!history || history.length < 20) return 0;

        const prices = history.slice(-20).map(h => h.price);
        const mean = this.calculateAverage(prices);
        const std = this.calculateStdDev(prices);

        const currentPrice = prices[prices.length - 1];
        return (currentPrice - mean) / std;
    }

    calculateRSI(asset, period = 14) {
        const history = this.priceHistory.get(asset);
        if (!history || history.length < period + 1) return 50;

        const gains = [];
        const losses = [];

        for (let i = 1; i <= period; i++) {
            const change = history[history.length - i].price - history[history.length - i - 1].price;
            if (change > 0) {
                gains.push(change);
            } else {
                losses.push(change * -1);
            }
        }

        const avgGain = this.calculateAverage(gains);
        const avgLoss = this.calculateAverage(losses);

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateVolatility(asset) {
        const history = this.priceHistory.get(asset);
        if (!history || history.length < 20) return 0;

        const returns = [];
        for (let i = 1; i < history.length; i++) {
            const ret = (history[i].price - history[i-1].price) / history[i-1].price;
            returns.push(ret);
        }

        return this.calculateStdDev(returns);
    }

    calculateAverage(values) {
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    calculateStdDev(values) {
        const mean = this.calculateAverage(values);
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        const avgSquaredDiff = this.calculateAverage(squaredDiffs);
        return Math.sqrt(avgSquaredDiff);
    }

    /**
     * Utility methods
     */
    generatePositionId() {
        return 'POS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    calculateFees(amount) {
        return amount * 0.001; // 0.1% fee
    }

    calculateTickSize(asset) {
        // This would be asset-specific
        return 0.01; // Default tick size
    }

    calculateBreakoutLevel(asset) {
        const history = this.priceHistory.get(asset);
        if (!history || history.length < 20) return { upper: 0, lower: 0 };

        const prices = history.slice(-20).map(h => h.price);
        const high = Math.max(...prices);
        const low = Math.min(...prices);

        return {
            upper: high * 1.02, // 2% above recent high
            lower: low * 0.98  // 2% below recent low
        };
    }

    calculateTrend(asset) {
        const history = this.priceHistory.get(asset);
        if (!history || history.length < 20) return 0;

        // Simple trend calculation using linear regression
        const prices = history.slice(-20).map((h, i) => ({ x: i, y: h.price }));
        const n = prices.length;
        const sumX = prices.reduce((sum, p) => sum + p.x, 0);
        const sumY = prices.reduce((sum, p) => sum + p.y, 0);
        const sumXY = prices.reduce((sum, p) => sum + p.x * p.y, 0);
        const sumXX = prices.reduce((sum, p) => sum + p.x * p.x, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        return slope > 0 ? 1 : slope < 0 ? -1 : 0;
    }

    calculateSupportLevel(asset) {
        const history = this.priceHistory.get(asset);
        if (!history || history.length < 20) return 0;

        const prices = history.slice(-20).map(h => h.price);
        return Math.min(...prices) * 1.01; // 1% above lowest low
    }

    calculateResistanceLevel(asset) {
        const history = this.priceHistory.get(asset);
        if (!history || history.length < 20) return 0;

        const prices = history.slice(-20).map(h => h.price);
        return Math.max(...prices) * 0.99; // 1% below highest high
    }

    calculateVolumeTrend(asset) {
        const history = this.priceHistory.get(asset);
        if (!history || history.length < 20) return 0;

        const volumes = history.slice(-10).map(h => h.volume || 1);
        const avgVolume = this.calculateAverage(volumes);
        const currentVolume = volumes[volumes.length - 1];

        return currentVolume / avgVolume;
    }

    checkScalpExit(asset, position) {
        const marketData = this.marketData.get(asset);
        const entryPrice = position.entryPrice;
        const currentPrice = marketData.price;

        // Exit if price moves 0.5% in either direction
        const priceChange = Math.abs(currentPrice - entryPrice) / entryPrice;
        return priceChange >= 0.005;
    }

    /**
     * Start monitoring and maintenance
     */
    startMonitoring() {
        // Check positions every minute
        this.monitoringInterval = setInterval(async () => {
            try {
                // Check all positions
                for (const [asset, position] of this.positions) {
                    await this.checkPositionUpdates(asset, position);
                }

                // Update portfolio value
                this.portfolio.totalValue = this.calculateTotalValue();

                // Check drawdown
                const drawdown = this.calculateDrawdown();
                if (drawdown > this.params.maxDrawdown) {
                    await this.alertSystem.logAlert('CRITICAL', 'Maximum drawdown exceeded', {
                        drawdown,
                        maxDrawdown: this.params.maxDrawdown
                    });
                }

            } catch (error) {
                await this.alertSystem.logError(error, { context: 'monitoring' });
            }
        }, 60000); // Every minute
    }

    /**
     * Calculate current drawdown
     */
    calculateDrawdown() {
        // Simplified drawdown calculation
        const currentValue = this.portfolio.totalValue;
        const peakValue = Math.max(currentValue, this.portfolio.peakValue || currentValue);

        this.portfolio.peakValue = peakValue;
        return (peakValue - currentValue) / peakValue;
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Get trading statistics
     */
    getStats() {
        return {
            portfolio: this.portfolio,
            performance: this.performance,
            positions: Array.from(this.positions.values()),
            activeOrders: Array.from(this.activeOrders.values())
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopMonitoring();
        this.positions.clear();
        this.activeOrders.clear();
        this.marketData.clear();
        this.priceHistory.clear();
    }
}

module.exports = TradingEngine;
