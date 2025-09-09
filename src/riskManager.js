/**
 * Risk Management System
 * Implements comprehensive risk controls, monitoring, and mitigation strategies
 */

const EventEmitter = require('events');

class RiskManager extends EventEmitter {
    constructor(config, tradingEngine, alertSystem) {
        super();
        this.config = config;
        this.tradingEngine = tradingEngine;
        this.alertSystem = alertSystem;

        // Risk parameters
        this.riskParams = {
            maxDrawdown: config.maxDrawdown || 0.2, // 20%
            maxDailyLoss: config.maxDailyLoss || 0.1, // 10%
            maxPositionSize: config.maxPositionSize || 0.1, // 10% of portfolio
            maxLeverage: config.maxLeverage || 5,
            maxConcentration: config.maxConcentration || 0.25, // 25% in single asset
            varLimit: config.varLimit || 0.15, // 15% VaR limit
            stressTestThreshold: config.stressTestThreshold || 0.3, // 30% stress loss
            correlationLimit: config.correlationLimit || 0.8, // 80% correlation limit
            liquidityThreshold: config.liquidityThreshold || 0.7 // 70% liquidity score
        };

        // Risk state
        this.riskState = {
            currentDrawdown: 0,
            dailyPnL: 0,
            portfolioVar: 0,
            concentrationRisk: {},
            correlationRisk: {},
            liquidityRisk: {},
            lastResetDate: new Date().toDateString(),
            breaches: [],
            riskScore: 0
        };

        // Risk monitoring
        this.monitoring = {
            active: true,
            interval: config.monitoringInterval || 30000, // 30 seconds
            alerts: new Map(),
            thresholds: new Map()
        };

        // Historical risk data
        this.history = {
            drawdowns: [],
            dailyLosses: [],
            varHistory: [],
            breaches: []
        };

        this.initialize();
    }

    /**
     * Initialize risk manager
     */
    async initialize() {
        await this.alertSystem.logAlert('INFO', 'Risk Manager initialized', {
            parameters: this.riskParams
        });

        // Set up event listeners
        this.setupEventListeners();

        // Start risk monitoring
        this.startMonitoring();

        // Perform initial risk assessment
        await this.performRiskAssessment();
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Trading engine events
        if (this.tradingEngine.on) {
            this.tradingEngine.on('positionOpened', (position) => {
                this.onPositionOpened(position);
            });

            this.tradingEngine.on('positionClosed', (position) => {
                this.onPositionClosed(position);
            });
        }

        // Note: Alert system doesn't emit events, alerts are handled directly
    }

    /**
     * Handle position opened event
     */
    async onPositionOpened(position) {
        await this.checkPositionRisk(position);
        await this.updateRiskMetrics();
        await this.performRiskAssessment();
    }

    /**
     * Handle position closed event
     */
    async onPositionClosed(position) {
        await this.updateRiskMetrics();
        await this.performRiskAssessment();
    }

    /**
     * Handle alert event
     */
    onAlert(alert) {
        if (alert.level === 'CRITICAL' || alert.level === 'ERROR') {
            this.riskState.breaches.push({
                timestamp: new Date(),
                alert: alert,
                riskImpact: this.assessAlertRisk(alert)
            });
        }
    }

    /**
     * Check position risk before opening
     */
    async checkPositionRisk(position) {
        const risks = [];

        // Size risk
        const positionSizeRisk = this.checkPositionSizeRisk(position);
        if (positionSizeRisk) risks.push(positionSizeRisk);

        // Concentration risk
        const concentrationRisk = this.checkConcentrationRisk(position);
        if (concentrationRisk) risks.push(concentrationRisk);

        // Correlation risk
        const correlationRisk = this.checkCorrelationRisk(position);
        if (correlationRisk) risks.push(correlationRisk);

        // Liquidity risk
        const liquidityRisk = this.checkLiquidityRisk(position);
        if (liquidityRisk) risks.push(liquidityRisk);

        // Leverage risk
        const leverageRisk = this.checkLeverageRisk(position);
        if (leverageRisk) risks.push(leverageRisk);

        if (risks.length > 0) {
            await this.alertSystem.logAlert('WARNING', 'Position risk detected', {
                position: position.id,
                risks: risks
            });

            // Check if position should be blocked
            const shouldBlock = risks.some(risk => risk.severity === 'CRITICAL');
            if (shouldBlock) {
                await this.alertSystem.logAlert('CRITICAL', 'Position blocked due to risk limits', {
                    position: position.id,
                    blockingRisks: risks.filter(r => r.severity === 'CRITICAL')
                });
                return false;
            }
        }

        return true;
    }

    /**
     * Check position size risk
     */
    checkPositionSizeRisk(position) {
        const portfolioValue = this.tradingEngine.portfolio.totalValue;
        const positionValue = position.size * position.entryPrice;
        const positionPercent = positionValue / portfolioValue;

        if (positionPercent > this.riskParams.maxPositionSize) {
            return {
                type: 'POSITION_SIZE',
                severity: 'HIGH',
                message: `Position size ${positionPercent.toFixed(3)} exceeds limit ${this.riskParams.maxPositionSize}`,
                value: positionPercent,
                limit: this.riskParams.maxPositionSize
            };
        }

        return null;
    }

    /**
     * Check concentration risk
     */
    checkConcentrationRisk(position) {
        const asset = position.asset;
        const existingPositions = Array.from(this.tradingEngine.positions.values())
            .filter(p => p.asset === asset);

        const totalAssetValue = existingPositions.reduce((sum, p) => {
            const marketData = this.tradingEngine.marketData.get(asset);
            return sum + (p.size * (marketData ? marketData.price : p.entryPrice));
        }, 0) + (position.size * position.entryPrice);

        const portfolioValue = this.tradingEngine.portfolio.totalValue;
        const concentration = totalAssetValue / portfolioValue;

        if (concentration > this.riskParams.maxConcentration) {
            return {
                type: 'CONCENTRATION',
                severity: 'HIGH',
                message: `Asset concentration ${concentration.toFixed(3)} exceeds limit ${this.riskParams.maxConcentration}`,
                value: concentration,
                limit: this.riskParams.maxConcentration
            };
        }

        return null;
    }

    /**
     * Check correlation risk
     */
    checkCorrelationRisk(position) {
        const asset = position.asset;
        const correlations = this.calculateAssetCorrelations(asset);

        const highCorrelations = Object.entries(correlations)
            .filter(([otherAsset, corr]) => Math.abs(corr) > this.riskParams.correlationLimit)
            .filter(([otherAsset]) => otherAsset !== asset);

        if (highCorrelations.length > 0) {
            return {
                type: 'CORRELATION',
                severity: 'MEDIUM',
                message: `High correlation with ${highCorrelations.length} assets`,
                correlations: highCorrelations,
                limit: this.riskParams.correlationLimit
            };
        }

        return null;
    }

    /**
     * Check liquidity risk
     */
    checkLiquidityRisk(position) {
        const asset = position.asset;
        const marketData = this.tradingEngine.marketData.get(asset);

        if (!marketData) return null;

        const spread = (marketData.ask - marketData.bid) / marketData.price;
        const volume = marketData.volume || 0;
        const positionValue = position.size * position.entryPrice;

        // Liquidity score (0-1, higher is better)
        const liquidityScore = Math.min(1, volume / (positionValue * 100));

        if (liquidityScore < this.riskParams.liquidityThreshold) {
            return {
                type: 'LIQUIDITY',
                severity: 'MEDIUM',
                message: `Low liquidity score ${liquidityScore.toFixed(3)}`,
                score: liquidityScore,
                threshold: this.riskParams.liquidityThreshold
            };
        }

        return null;
    }

    /**
     * Check leverage risk
     */
    checkLeverageRisk(position) {
        const currentLeverage = this.calculateCurrentLeverage();

        if (currentLeverage > this.riskParams.maxLeverage) {
            return {
                type: 'LEVERAGE',
                severity: 'CRITICAL',
                message: `Leverage ${currentLeverage.toFixed(2)} exceeds limit ${this.riskParams.maxLeverage}`,
                value: currentLeverage,
                limit: this.riskParams.maxLeverage
            };
        }

        return null;
    }

    /**
     * Calculate current leverage
     */
    calculateCurrentLeverage() {
        const marginUsed = this.tradingEngine.portfolio.marginUsed;
        const totalValue = this.tradingEngine.portfolio.totalValue;

        return marginUsed > 0 ? totalValue / (totalValue - marginUsed) : 1;
    }

    /**
     * Calculate asset correlations
     */
    calculateAssetCorrelations(targetAsset) {
        const correlations = {};
        const targetHistory = this.tradingEngine.priceHistory.get(targetAsset);

        if (!targetHistory) return correlations;

        for (const [asset, history] of this.tradingEngine.priceHistory) {
            if (asset === targetAsset) continue;

            const corr = this.calculateCorrelation(targetHistory, history);
            correlations[asset] = corr;
        }

        return correlations;
    }

    /**
     * Calculate correlation between two price histories
     */
    calculateCorrelation(history1, history2) {
        if (!history1 || !history2 || history1.length !== history2.length) return 0;

        const returns1 = this.calculateReturns(history1);
        const returns2 = this.calculateReturns(history2);

        const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
        const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;

        let numerator = 0;
        let sumSq1 = 0;
        let sumSq2 = 0;

        for (let i = 0; i < returns1.length; i++) {
            const diff1 = returns1[i] - mean1;
            const diff2 = returns2[i] - mean2;

            numerator += diff1 * diff2;
            sumSq1 += diff1 * diff1;
            sumSq2 += diff2 * diff2;
        }

        const denominator = Math.sqrt(sumSq1 * sumSq2);
        return denominator > 0 ? numerator / denominator : 0;
    }

    /**
     * Calculate returns from price history
     */
    calculateReturns(history) {
        const returns = [];
        for (let i = 1; i < history.length; i++) {
            const ret = (history[i].price - history[i-1].price) / history[i-1].price;
            returns.push(ret);
        }
        return returns;
    }

    /**
     * Update risk metrics
     */
    async updateRiskMetrics() {
        try {
            // Update drawdown
            this.riskState.currentDrawdown = this.calculateDrawdown();

            // Update daily P&L
            this.updateDailyPnL();

            // Update VaR
            this.riskState.portfolioVar = this.calculateVaR();

            // Update concentration risk
            this.riskState.concentrationRisk = this.calculateConcentrationRisk();

            // Update correlation risk
            this.riskState.correlationRisk = this.calculateCorrelationRisk();

            // Update liquidity risk
            this.riskState.liquidityRisk = this.calculateLiquidityRisk();

            // Calculate overall risk score
            this.riskState.riskScore = this.calculateRiskScore();

            // Store historical data
            this.storeHistoricalData();

        } catch (error) {
            await this.alertSystem.logError(error, { context: 'risk_metrics_update' });
        }
    }

    /**
     * Calculate current drawdown
     */
    calculateDrawdown() {
        const portfolioValues = this.history.portfolioValues || [];
        if (portfolioValues.length === 0) return 0;

        const current = portfolioValues[portfolioValues.length - 1];
        const peak = Math.max(...portfolioValues);

        return (peak - current) / peak;
    }

    /**
     * Update daily P&L
     */
    updateDailyPnL() {
        const today = new Date().toDateString();

        if (today !== this.riskState.lastResetDate) {
            // Reset daily P&L
            this.riskState.dailyPnL = 0;
            this.riskState.lastResetDate = today;
        }

        // Calculate today's P&L from closed positions
        const todayTrades = this.history.trades?.filter(trade =>
            new Date(trade.timestamp).toDateString() === today && trade.type === 'CLOSE'
        ) || [];

        this.riskState.dailyPnL = todayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    }

    /**
     * Calculate Value at Risk (VaR)
     */
    calculateVaR(confidence = 0.95) {
        const pnlHistory = this.history.pnl || [];
        if (pnlHistory.length < 30) return 0;

        const losses = pnlHistory.filter(pnl => pnl < 0).map(pnl => Math.abs(pnl));
        if (losses.length === 0) return 0;

        losses.sort((a, b) => a - b);
        const index = Math.floor(losses.length * (1 - confidence));

        return losses[index] || 0;
    }

    /**
     * Calculate concentration risk
     */
    calculateConcentrationRisk() {
        const concentrations = {};
        const portfolioValue = this.tradingEngine.portfolio.totalValue;

        for (const [asset, position] of this.tradingEngine.positions) {
            const marketData = this.tradingEngine.marketData.get(asset);
            const positionValue = position.size * (marketData ? marketData.price : position.entryPrice);
            concentrations[asset] = positionValue / portfolioValue;
        }

        return concentrations;
    }

    /**
     * Calculate correlation risk
     */
    calculateCorrelationRisk() {
        const assets = Array.from(this.tradingEngine.positions.keys());
        const correlations = {};

        for (let i = 0; i < assets.length; i++) {
            for (let j = i + 1; j < assets.length; j++) {
                const asset1 = assets[i];
                const asset2 = assets[j];

                const corr = this.calculateCorrelation(
                    this.tradingEngine.priceHistory.get(asset1),
                    this.tradingEngine.priceHistory.get(asset2)
                );

                correlations[`${asset1}_${asset2}`] = corr;
            }
        }

        return correlations;
    }

    /**
     * Calculate liquidity risk
     */
    calculateLiquidityRisk() {
        const liquidityScores = {};

        for (const [asset, position] of this.tradingEngine.positions) {
            const marketData = this.tradingEngine.marketData.get(asset);
            if (marketData) {
                const spread = (marketData.ask - marketData.bid) / marketData.price;
                const volume = marketData.volume || 0;
                const positionValue = position.size * position.entryPrice;

                // Liquidity score (0-1, higher is better)
                liquidityScores[asset] = Math.min(1, volume / (positionValue * 100));
            }
        }

        return liquidityScores;
    }

    /**
     * Calculate overall risk score
     */
    calculateRiskScore() {
        let score = 0;

        // Drawdown component (0-40 points)
        score += Math.min(40, this.riskState.currentDrawdown * 200);

        // Daily loss component (0-30 points)
        const dailyLossPercent = Math.abs(this.riskState.dailyPnL) / this.tradingEngine.portfolio.totalValue;
        score += Math.min(30, dailyLossPercent * 300);

        // VaR component (0-20 points)
        const varPercent = this.riskState.portfolioVar / this.tradingEngine.portfolio.totalValue;
        score += Math.min(20, varPercent * 200);

        // Concentration component (0-10 points)
        const maxConcentration = Math.max(...Object.values(this.riskState.concentrationRisk));
        score += Math.min(10, maxConcentration * 40);

        return Math.min(100, score);
    }

    /**
     * Store historical risk data
     */
    storeHistoricalData() {
        const timestamp = new Date();

        this.history.drawdowns.push({
            timestamp,
            value: this.riskState.currentDrawdown
        });

        this.history.dailyLosses.push({
            timestamp,
            value: this.riskState.dailyPnL
        });

        this.history.varHistory.push({
            timestamp,
            value: this.riskState.portfolioVar
        });

        // Keep only last 1000 points
        Object.keys(this.history).forEach(key => {
            if (this.history[key].length > 1000) {
                this.history[key] = this.history[key].slice(-1000);
            }
        });
    }

    /**
     * Perform comprehensive risk assessment
     */
    async performRiskAssessment() {
        const assessment = {
            timestamp: new Date(),
            overallRisk: this.assessOverallRisk(),
            riskFactors: this.identifyRiskFactors(),
            recommendations: this.generateRecommendations(),
            riskLimits: this.checkRiskLimits()
        };

        // Emit assessment
        this.emit('riskAssessment', assessment);

        // Alert on critical risks
        if (assessment.overallRisk === 'CRITICAL') {
            await this.alertSystem.logAlert('CRITICAL', 'Critical risk level detected', assessment);
        } else if (assessment.overallRisk === 'HIGH') {
            await this.alertSystem.logAlert('WARNING', 'High risk level detected', assessment);
        }

        return assessment;
    }

    /**
     * Assess overall risk level
     */
    assessOverallRisk() {
        const score = this.riskState.riskScore;

        if (score >= 80) return 'CRITICAL';
        if (score >= 60) return 'HIGH';
        if (score >= 40) return 'MEDIUM';
        if (score >= 20) return 'LOW';
        return 'VERY_LOW';
    }

    /**
     * Identify key risk factors
     */
    identifyRiskFactors() {
        const factors = [];

        // Drawdown risk
        if (this.riskState.currentDrawdown > this.riskParams.maxDrawdown * 0.8) {
            factors.push({
                type: 'DRAWDOWN',
                severity: 'HIGH',
                description: `Current drawdown ${this.riskState.currentDrawdown.toFixed(3)} near limit ${this.riskParams.maxDrawdown}`
            });
        }

        // Daily loss risk
        const dailyLossPercent = Math.abs(this.riskState.dailyPnL) / this.tradingEngine.portfolio.totalValue;
        if (dailyLossPercent > this.riskParams.maxDailyLoss * 0.8) {
            factors.push({
                type: 'DAILY_LOSS',
                severity: 'HIGH',
                description: `Daily loss ${dailyLossPercent.toFixed(3)} near limit ${this.riskParams.maxDailyLoss}`
            });
        }

        // VaR risk
        const varPercent = this.riskState.portfolioVar / this.tradingEngine.portfolio.totalValue;
        if (varPercent > this.riskParams.varLimit * 0.8) {
            factors.push({
                type: 'VAR',
                severity: 'MEDIUM',
                description: `VaR ${varPercent.toFixed(3)} near limit ${this.riskParams.varLimit}`
            });
        }

        // Concentration risk
        const highConcentration = Object.entries(this.riskState.concentrationRisk)
            .filter(([asset, concentration]) => concentration > this.riskParams.maxConcentration * 0.8);

        if (highConcentration.length > 0) {
            factors.push({
                type: 'CONCENTRATION',
                severity: 'MEDIUM',
                description: `${highConcentration.length} assets near concentration limit`
            });
        }

        return factors;
    }

    /**
     * Generate risk mitigation recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        // Drawdown recommendations
        if (this.riskState.currentDrawdown > this.riskParams.maxDrawdown * 0.7) {
            recommendations.push({
                type: 'REDUCE_EXPOSURE',
                priority: 'HIGH',
                description: 'Consider reducing position sizes to limit further drawdown'
            });
        }

        // Daily loss recommendations
        const dailyLossPercent = Math.abs(this.riskState.dailyPnL) / this.tradingEngine.portfolio.totalValue;
        if (dailyLossPercent > this.riskParams.maxDailyLoss * 0.5) {
            recommendations.push({
                type: 'STOP_TRADING',
                priority: 'CRITICAL',
                description: 'Daily loss limit approaching, consider stopping trading for today'
            });
        }

        // Diversification recommendations
        const maxConcentration = Math.max(...Object.values(this.riskState.concentrationRisk));
        if (maxConcentration > this.riskParams.maxConcentration * 0.8) {
            recommendations.push({
                type: 'DIVERSIFY',
                priority: 'MEDIUM',
                description: 'Reduce concentration in highly weighted assets'
            });
        }

        // Correlation recommendations
        const highCorrelations = Object.values(this.riskState.correlationRisk)
            .filter(corr => Math.abs(corr) > this.riskParams.correlationLimit);

        if (highCorrelations.length > 0) {
            recommendations.push({
                type: 'HEDGE_CORRELATION',
                priority: 'MEDIUM',
                description: 'Consider hedging highly correlated positions'
            });
        }

        return recommendations;
    }

    /**
     * Check risk limits
     */
    checkRiskLimits() {
        const limits = {
            drawdown: {
                current: this.riskState.currentDrawdown,
                limit: this.riskParams.maxDrawdown,
                status: this.riskState.currentDrawdown > this.riskParams.maxDrawdown ? 'BREACHED' : 'OK'
            },
            dailyLoss: {
                current: Math.abs(this.riskState.dailyPnL) / this.tradingEngine.portfolio.totalValue,
                limit: this.riskParams.maxDailyLoss,
                status: (Math.abs(this.riskState.dailyPnL) / this.tradingEngine.portfolio.totalValue) > this.riskParams.maxDailyLoss ? 'BREACHED' : 'OK'
            },
            var: {
                current: this.riskState.portfolioVar / this.tradingEngine.portfolio.totalValue,
                limit: this.riskParams.varLimit,
                status: (this.riskState.portfolioVar / this.tradingEngine.portfolio.totalValue) > this.riskParams.varLimit ? 'BREACHED' : 'OK'
            }
        };

        return limits;
    }

    /**
     * Assess alert risk impact
     */
    assessAlertRisk(alert) {
        let impact = 'LOW';

        if (alert.level === 'CRITICAL') {
            impact = 'HIGH';
        } else if (alert.level === 'ERROR') {
            impact = 'MEDIUM';
        }

        // Check for specific risk-related keywords
        const riskKeywords = ['risk', 'drawdown', 'loss', 'exposure', 'concentration', 'correlation'];
        const message = alert.message.toLowerCase();

        if (riskKeywords.some(keyword => message.includes(keyword))) {
            impact = impact === 'HIGH' ? 'CRITICAL' : 'HIGH';
        }

        return impact;
    }

    /**
     * Start risk monitoring
     */
    startMonitoring() {
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.updateRiskMetrics();
                await this.performRiskAssessment();
                await this.checkRiskLimits();
            } catch (error) {
                await this.alertSystem.logError(error, { context: 'risk_monitoring' });
            }
        }, this.monitoring.interval);
    }

    /**
     * Stop risk monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Get risk report
     */
    getRiskReport() {
        return {
            currentState: this.riskState,
            parameters: this.riskParams,
            assessment: this.performRiskAssessment(),
            history: this.history,
            limits: this.checkRiskLimits()
        };
    }

    /**
     * Emergency stop - close all positions
     */
    async emergencyStop(reason) {
        await this.alertSystem.logAlert('CRITICAL', 'Emergency stop triggered', { reason });

        // Close all positions
        for (const [asset, position] of this.tradingEngine.positions) {
            await this.tradingEngine.closePosition(asset);
        }

        // Stop trading
        this.monitoring.active = false;
        this.stopMonitoring();

        this.emit('emergencyStop', { reason, timestamp: new Date() });
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopMonitoring();
        this.removeAllListeners();
    }
}

module.exports = RiskManager;
