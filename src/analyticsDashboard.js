/**
 * Analytics Dashboard
 * Provides real-time monitoring, visualization, and performance analytics
 */

const EventEmitter = require('events');

class AnalyticsDashboard extends EventEmitter {
    constructor(config, tradingEngine, alertSystem) {
        super();
        this.config = config;
        this.tradingEngine = tradingEngine;
        this.alertSystem = alertSystem;

        // Dashboard data
        this.dashboard = {
            portfolio: {},
            performance: {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                totalPnL: 0,
                winRate: 0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                currentDrawdown: 0,
                volatility: 0
            },
            risk: {},
            market: {},
            alerts: [],
            charts: {}
        };

        // Real-time metrics
        this.metrics = {
            responseTime: [],
            throughput: [],
            errorRate: [],
            memoryUsage: [],
            cpuUsage: []
        };

        // Historical data
        this.history = {
            portfolioValues: [],
            pnl: [],
            drawdown: [],
            trades: []
        };

        // Dashboard refresh interval
        this.refreshInterval = config.refreshInterval || 5000; // 5 seconds
        this.maxHistoryPoints = config.maxHistoryPoints || 1000;

        this.initialize();
    }

    /**
     * Initialize dashboard
     */
    async initialize() {
        await this.alertSystem.logAlert('INFO', 'Analytics Dashboard initialized');

        // Set up event listeners
        this.setupEventListeners();

        // Generate initial dashboard data
        await this.updateDashboard();

        // Add initial portfolio value to history
        const initialValue = this.dashboard.portfolio.totalValue || 100000;
        this.history.portfolioValues.push({
            timestamp: new Date(),
            value: initialValue
        });

        // Start data collection
        this.startDataCollection();
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Trading engine events
        this.tradingEngine.on('positionOpened', (position) => {
            this.onPositionOpened(position);
        });

        this.tradingEngine.on('positionClosed', (position) => {
            this.onPositionClosed(position);
        });

        // Alert system events
        this.alertSystem.on('alert', (alert) => {
            this.onAlert(alert);
        });
    }

    /**
     * Handle position opened event
     */
    onPositionOpened(position) {
        this.history.trades.push({
            ...position,
            type: 'OPEN'
        });

        this.emit('dashboardUpdate', {
            type: 'position_opened',
            data: position
        });
    }

    /**
     * Handle position closed event
     */
    onPositionClosed(position) {
        this.history.trades.push({
            ...position,
            type: 'CLOSE'
        });

        this.emit('dashboardUpdate', {
            type: 'position_closed',
            data: position
        });
    }

    /**
     * Handle alert event
     */
    onAlert(alert) {
        this.dashboard.alerts.unshift(alert);

        // Keep only last 50 alerts
        if (this.dashboard.alerts.length > 50) {
            this.dashboard.alerts = this.dashboard.alerts.slice(0, 50);
        }

        this.emit('dashboardUpdate', {
            type: 'alert',
            data: alert
        });
    }

    /**
     * Start data collection
     */
    startDataCollection() {
        this.collectionInterval = setInterval(async () => {
            try {
                await this.collectMetrics();
                await this.updateDashboard();
            } catch (error) {
                await this.alertSystem.logError(error, { context: 'data_collection' });
            }
        }, this.refreshInterval);
    }

    /**
     * Collect real-time metrics
     */
    async collectMetrics() {
        const startTime = Date.now();

        try {
            // System metrics
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            const metrics = {
                timestamp: new Date(),
                memoryUsage: memUsage.heapUsed / memUsage.heapTotal,
                cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000,
                responseTime: Date.now() - startTime,
                activePositions: this.tradingEngine.positions.size,
                totalValue: this.tradingEngine.portfolio.totalValue
            };

            // Add portfolio value to history
            this.history.portfolioValues.push({
                timestamp: metrics.timestamp,
                value: metrics.totalValue
            });

            // Keep only last maxHistoryPoints
            if (this.history.portfolioValues.length > this.maxHistoryPoints) {
                this.history.portfolioValues.shift();
            }

            // Add to metrics history
            this.addMetric(metrics);

            // Calculate derived metrics
            this.calculateDerivedMetrics();

        } catch (error) {
            await this.alertSystem.logError(error, { context: 'metrics_collection' });
        }
    }

    /**
     * Add metric to history
     */
    addMetric(metric) {
        // Add to each metric type
        Object.keys(metric).forEach(key => {
            if (key !== 'timestamp' && this.metrics[key] !== undefined) {
                this.metrics[key].push({
                    timestamp: metric.timestamp,
                    value: metric[key]
                });

                // Keep only last maxHistoryPoints
                if (this.metrics[key].length > this.maxHistoryPoints) {
                    this.metrics[key].shift();
                }
            }
        });
    }

    /**
     * Calculate derived metrics
     */
    calculateDerivedMetrics() {
        // Calculate averages and trends
        Object.keys(this.metrics).forEach(key => {
            const data = this.metrics[key];
            if (data.length > 1) {
                const recent = data.slice(-10); // Last 10 points
                const avg = recent.reduce((sum, point) => sum + point.value, 0) / recent.length;

                // Calculate trend (simple linear regression slope)
                const trend = this.calculateTrend(recent.map(p => p.value));

                this.metrics[key + '_avg'] = avg;
                this.metrics[key + '_trend'] = trend;
            }
        });
    }

    /**
     * Calculate trend using linear regression
     */
    calculateTrend(values) {
        if (values.length < 2) return 0;

        const n = values.length;
        const x = Array.from({length: n}, (_, i) => i);
        const y = values;

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        return slope;
    }

    /**
     * Update dashboard data
     */
    async updateDashboard() {
        try {
            const tradingStats = this.tradingEngine.getStats();

            // Portfolio section
            this.dashboard.portfolio = {
                totalValue: tradingStats.portfolio.totalValue,
                cash: tradingStats.portfolio.cash,
                marginUsed: tradingStats.portfolio.marginUsed,
                positions: tradingStats.positions.length,
                lastUpdate: new Date()
            };

            // Performance section - ensure all properties are present
            this.dashboard.performance = {
                totalTrades: tradingStats.performance.totalTrades || 0,
                winningTrades: tradingStats.performance.winningTrades || 0,
                losingTrades: tradingStats.performance.losingTrades || 0,
                totalPnL: tradingStats.performance.totalPnL || 0,
                winRate: tradingStats.performance.winRate || 0,
                sharpeRatio: tradingStats.performance.sharpeRatio || 0,
                maxDrawdown: this.calculateMaxDrawdown(),
                currentDrawdown: this.calculateCurrentDrawdown(),
                volatility: this.calculatePortfolioVolatility()
            };

            // Risk section
            this.dashboard.risk = {
                valueAtRisk: this.calculateVaR(),
                expectedShortfall: this.calculateExpectedShortfall(),
                stressTestResults: await this.runStressTest(),
                correlationMatrix: this.calculateCorrelationMatrix()
            };

            // Market section
            this.dashboard.market = {
                activeAssets: Array.from(this.tradingEngine.marketData.keys()),
                marketSentiment: this.calculateMarketSentiment(),
                volatilityIndex: this.calculateVolatilityIndex(),
                liquidityMetrics: this.calculateLiquidityMetrics()
            };

            // Charts data
            this.updateCharts();

            this.emit('dashboardUpdate', {
                type: 'full_update',
                data: this.dashboard
            });

        } catch (error) {
            await this.alertSystem.logError(error, { context: 'dashboard_update' });
        }
    }

    /**
     * Update charts data
     */
    updateCharts() {
        // Portfolio value over time
        this.dashboard.charts.portfolioValue = {
            labels: this.history.portfolioValues.map(p => p.timestamp),
            data: this.history.portfolioValues.map(p => p.value)
        };

        // P&L over time
        this.dashboard.charts.pnl = {
            labels: this.history.pnl.map(p => p.timestamp),
            data: this.history.pnl.map(p => p.value)
        };

        // Drawdown chart
        this.dashboard.charts.drawdown = {
            labels: this.history.drawdown.map(d => d.timestamp),
            data: this.history.drawdown.map(d => d.value)
        };

        // Performance metrics
        this.dashboard.charts.performance = {
            winRate: this.dashboard.performance.winRate,
            totalTrades: this.dashboard.performance.totalTrades,
            avgTrade: this.dashboard.performance.totalTrades > 0 ?
                this.dashboard.performance.totalPnL / this.dashboard.performance.totalTrades : 0
        };

        // New advanced charts
        this.updateAdvancedCharts();
    }

    /**
     * Update advanced charts data
     */
    updateAdvancedCharts() {
        // Returns distribution chart
        this.dashboard.charts.returnsDistribution = this.calculateReturnsDistribution();

        // Volatility chart
        this.dashboard.charts.volatility = {
            labels: this.history.portfolioValues.map(p => p.timestamp),
            data: this.calculateRollingVolatility()
        };

        // Sharpe ratio over time
        this.dashboard.charts.sharpeRatio = {
            labels: this.history.portfolioValues.map(p => p.timestamp),
            data: this.calculateRollingSharpeRatio()
        };

        // Win/Loss ratio chart
        this.dashboard.charts.winLossRatio = this.calculateWinLossRatio();

        // Risk-adjusted returns
        this.dashboard.charts.riskAdjustedReturns = this.calculateRiskAdjustedReturns();

        // Market correlation heatmap
        this.dashboard.charts.correlationHeatmap = this.calculateCorrelationHeatmap();

        // Performance attribution
        this.dashboard.charts.performanceAttribution = this.calculatePerformanceAttribution();
    }

    /**
     * Calculate returns distribution
     */
    calculateReturnsDistribution() {
        const returns = [];
        const values = this.history.portfolioValues.map(p => p.value);

        for (let i = 1; i < values.length; i++) {
            returns.push((values[i] - values[i-1]) / values[i-1]);
        }

        if (returns.length === 0) return { bins: [], frequencies: [] };

        // Create histogram bins
        const min = Math.min(...returns);
        const max = Math.max(...returns);
        const binCount = 20;
        const binSize = (max - min) / binCount;

        const bins = [];
        const frequencies = [];

        for (let i = 0; i < binCount; i++) {
            const binStart = min + i * binSize;
            const binEnd = min + (i + 1) * binSize;
            bins.push((binStart + binEnd) / 2);

            const count = returns.filter(r => r >= binStart && r < binEnd).length;
            frequencies.push(count);
        }

        return { bins, frequencies };
    }

    /**
     * Calculate rolling volatility
     */
    calculateRollingVolatility(windowSize = 20) {
        const values = this.history.portfolioValues.map(p => p.value);
        const volatility = [];

        for (let i = windowSize; i < values.length; i++) {
            const window = values.slice(i - windowSize, i);
            const returns = [];

            for (let j = 1; j < window.length; j++) {
                returns.push((window[j] - window[j-1]) / window[j-1]);
            }

            if (returns.length > 1) {
                const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
                const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
                volatility.push(Math.sqrt(variance));
            } else {
                volatility.push(0);
            }
        }

        return volatility;
    }

    /**
     * Calculate rolling Sharpe ratio
     */
    calculateRollingSharpeRatio(windowSize = 20) {
        const values = this.history.portfolioValues.map(p => p.value);
        const sharpeRatios = [];

        for (let i = windowSize; i < values.length; i++) {
            const window = values.slice(i - windowSize, i);
            const returns = [];

            for (let j = 1; j < window.length; j++) {
                returns.push((window[j] - window[j-1]) / window[j-1]);
            }

            if (returns.length > 1) {
                const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
                const stdDev = Math.sqrt(
                    returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length
                );

                const riskFreeRate = 0.02 / 252; // Daily risk-free rate
                const sharpe = stdDev > 0 ? (mean - riskFreeRate) / stdDev : 0;
                sharpeRatios.push(sharpe);
            } else {
                sharpeRatios.push(0);
            }
        }

        return sharpeRatios;
    }

    /**
     * Calculate win/loss ratio
     */
    calculateWinLossRatio() {
        const winningTrades = this.dashboard.performance.winningTrades;
        const losingTrades = this.dashboard.performance.losingTrades;

        if (losingTrades === 0) return winningTrades > 0 ? Infinity : 0;

        return winningTrades / losingTrades;
    }

    /**
     * Calculate risk-adjusted returns
     */
    calculateRiskAdjustedReturns() {
        const totalReturn = this.history.portfolioValues.length > 1 ?
            (this.history.portfolioValues[this.history.portfolioValues.length - 1].value -
             this.history.portfolioValues[0].value) / this.history.portfolioValues[0].value : 0;

        const volatility = this.calculatePortfolioVolatility();
        const riskFreeRate = 0.02; // 2% annual risk-free rate

        return {
            totalReturn,
            volatility,
            sharpeRatio: volatility > 0 ? (totalReturn - riskFreeRate) / volatility : 0,
            sortinoRatio: this.calculateSortinoRatio(),
            calmarRatio: this.calculateCalmarRatio()
        };
    }

    /**
     * Calculate Sortino ratio
     */
    calculateSortinoRatio() {
        const returns = [];
        const values = this.history.portfolioValues.map(p => p.value);

        for (let i = 1; i < values.length; i++) {
            returns.push((values[i] - values[i-1]) / values[i-1]);
        }

        if (returns.length === 0) return 0;

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const riskFreeRate = 0.02 / 252; // Daily risk-free rate

        // Calculate downside deviation (only negative returns)
        const downsideReturns = returns.filter(r => r < riskFreeRate);
        const downsideDeviation = downsideReturns.length > 0 ?
            Math.sqrt(downsideReturns.reduce((sum, ret) => sum + Math.pow(ret - riskFreeRate, 2), 0) / downsideReturns.length) : 0;

        return downsideDeviation > 0 ? (mean - riskFreeRate) / downsideDeviation : 0;
    }

    /**
     * Calculate Calmar ratio
     */
    calculateCalmarRatio() {
        const maxDrawdown = this.calculateMaxDrawdown();
        const totalReturn = this.history.portfolioValues.length > 1 ?
            (this.history.portfolioValues[this.history.portfolioValues.length - 1].value -
             this.history.portfolioValues[0].value) / this.history.portfolioValues[0].value : 0;

        return maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;
    }

    /**
     * Calculate correlation heatmap
     */
    calculateCorrelationHeatmap() {
        const assets = Array.from(this.tradingEngine.marketData.keys());
        if (assets.length < 2) return { assets: [], correlations: [] };

        const correlations = [];

        for (let i = 0; i < assets.length; i++) {
            const row = [];
            for (let j = 0; j < assets.length; j++) {
                if (i === j) {
                    row.push(1); // Perfect correlation with itself
                } else {
                    const corr = this.calculateCorrelation(assets[i], assets[j]);
                    row.push(corr);
                }
            }
            correlations.push(row);
        }

        return { assets, correlations };
    }

    /**
     * Calculate performance attribution
     */
    calculatePerformanceAttribution() {
        const trades = this.history.trades;
        const attribution = {
            byAsset: {},
            byStrategy: {},
            byTimeOfDay: {},
            byDayOfWeek: {}
        };

        trades.forEach(trade => {
            const pnl = trade.pnl || 0;
            const asset = trade.asset || 'UNKNOWN';
            const strategy = trade.strategy || 'UNKNOWN';

            // By asset
            if (!attribution.byAsset[asset]) {
                attribution.byAsset[asset] = { pnl: 0, count: 0 };
            }
            attribution.byAsset[asset].pnl += pnl;
            attribution.byAsset[asset].count += 1;

            // By strategy
            if (!attribution.byStrategy[strategy]) {
                attribution.byStrategy[strategy] = { pnl: 0, count: 0 };
            }
            attribution.byStrategy[strategy].pnl += pnl;
            attribution.byStrategy[strategy].count += 1;

            // By time of day
            const hour = new Date(trade.timestamp).getHours();
            const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
            if (!attribution.byTimeOfDay[timeOfDay]) {
                attribution.byTimeOfDay[timeOfDay] = { pnl: 0, count: 0 };
            }
            attribution.byTimeOfDay[timeOfDay].pnl += pnl;
            attribution.byTimeOfDay[timeOfDay].count += 1;

            // By day of week
            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(trade.timestamp).getDay()];
            if (!attribution.byDayOfWeek[dayOfWeek]) {
                attribution.byDayOfWeek[dayOfWeek] = { pnl: 0, count: 0 };
            }
            attribution.byDayOfWeek[dayOfWeek].pnl += pnl;
            attribution.byDayOfWeek[dayOfWeek].count += 1;
        });

        return attribution;
    }

    /**
     * Calculate current drawdown
     */
    calculateCurrentDrawdown() {
        const values = this.history.portfolioValues;
        if (values.length === 0) return 0;

        const current = values[values.length - 1].value;
        const peak = Math.max(...values.map(v => v.value));

        return (peak - current) / peak;
    }

    /**
     * Calculate Sharpe ratio
     */
    calculateSharpeRatio() {
        const pnl = this.history.pnl.map(p => p.value);
        if (pnl.length < 2) return 0;

        const avgReturn = pnl.reduce((a, b) => a + b, 0) / pnl.length;
        const stdDev = Math.sqrt(
            pnl.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / pnl.length
        );

        const riskFreeRate = 0.02; // 2% annual risk-free rate
        return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;
    }

    /**
     * Calculate maximum drawdown
     */
    calculateMaxDrawdown() {
        const values = this.history.portfolioValues.map(p => p.value);
        if (values.length === 0) return 0;

        let maxDrawdown = 0;
        let peak = values[0];

        for (const value of values) {
            if (value > peak) {
                peak = value;
            }
            const drawdown = (peak - value) / peak;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }

        return maxDrawdown;
    }

    /**
     * Calculate portfolio volatility
     */
    calculatePortfolioVolatility() {
        const returns = [];
        const values = this.history.portfolioValues.map(p => p.value);

        for (let i = 1; i < values.length; i++) {
            returns.push((values[i] - values[i-1]) / values[i-1]);
        }

        if (returns.length === 0) return 0;

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

        return Math.sqrt(variance);
    }

    /**
     * Calculate Value at Risk (VaR)
     */
    calculateVaR(confidence = 0.95) {
        const returns = this.history.pnl.map(p => p.value);
        if (returns.length < 30) return 0;

        returns.sort((a, b) => a - b);
        const index = Math.floor(returns.length * (1 - confidence));

        return Math.abs(returns[index]);
    }

    /**
     * Calculate Expected Shortfall
     */
    calculateExpectedShortfall(confidence = 0.95) {
        const returns = this.history.pnl.map(p => p.value);
        if (returns.length < 30) return 0;

        returns.sort((a, b) => a - b);
        const index = Math.floor(returns.length * (1 - confidence));
        const tailReturns = returns.slice(0, index);

        return tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length;
    }

    /**
     * Run stress test
     */
    async runStressTest() {
        const scenarios = [
            { name: 'Market Crash', shock: -0.3 },
            { name: 'High Volatility', shock: 0.2 },
            { name: 'Liquidity Crisis', shock: -0.15 }
        ];

        const results = [];

        for (const scenario of scenarios) {
            const stressedValue = this.dashboard.portfolio.totalValue * (1 + scenario.shock);
            const stressedDrawdown = (this.dashboard.portfolio.totalValue - stressedValue) / this.dashboard.portfolio.totalValue;

            results.push({
                scenario: scenario.name,
                stressedValue,
                stressedDrawdown,
                breach: stressedDrawdown > this.config.maxDrawdown
            });
        }

        return results;
    }

    /**
     * Calculate correlation matrix
     */
    calculateCorrelationMatrix() {
        const assets = Array.from(this.tradingEngine.marketData.keys());
        if (assets.length < 2) return {};

        const correlations = {};

        for (let i = 0; i < assets.length; i++) {
            for (let j = i + 1; j < assets.length; j++) {
                const asset1 = assets[i];
                const asset2 = assets[j];

                const corr = this.calculateCorrelation(asset1, asset2);
                correlations[`${asset1}_${asset2}`] = corr;
            }
        }

        return correlations;
    }

    /**
     * Calculate correlation between two assets
     */
    calculateCorrelation(asset1, asset2) {
        const history1 = this.tradingEngine.priceHistory.get(asset1);
        const history2 = this.tradingEngine.priceHistory.get(asset2);

        if (!history1 || !history2 || history1.length !== history2.length) return 0;

        const returns1 = [];
        const returns2 = [];

        for (let i = 1; i < history1.length; i++) {
            returns1.push((history1[i].price - history1[i-1].price) / history1[i-1].price);
            returns2.push((history2[i].price - history2[i].price) / history2[i-1].price);
        }

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
     * Calculate market sentiment
     */
    calculateMarketSentiment() {
        const assets = Array.from(this.tradingEngine.marketData.keys());
        if (assets.length === 0) return 0;

        let bullish = 0;
        let bearish = 0;

        for (const asset of assets) {
            const momentum = this.tradingEngine.calculateMomentum(asset);
            if (momentum > 0.1) bullish++;
            else if (momentum < -0.1) bearish++;
        }

        return (bullish - bearish) / assets.length;
    }

    /**
     * Calculate volatility index
     */
    calculateVolatilityIndex() {
        const assets = Array.from(this.tradingEngine.marketData.keys());
        if (assets.length === 0) return 0;

        const volatilities = assets.map(asset => this.tradingEngine.calculateVolatility(asset));
        return volatilities.reduce((a, b) => a + b, 0) / volatilities.length;
    }

    /**
     * Calculate liquidity metrics
     */
    calculateLiquidityMetrics() {
        const assets = Array.from(this.tradingEngine.marketData.keys());
        if (assets.length === 0) return {};

        const metrics = {
            averageSpread: 0,
            averageVolume: 0,
            bidAskRatio: 0
        };

        let totalSpread = 0;
        let totalVolume = 0;
        let totalBidAskRatio = 0;

        for (const asset of assets) {
            const data = this.tradingEngine.marketData.get(asset);
            if (data) {
                totalSpread += (data.ask - data.bid) / data.price;
                totalVolume += data.volume || 0;
                totalBidAskRatio += data.bid / data.ask;
            }
        }

        metrics.averageSpread = totalSpread / assets.length;
        metrics.averageVolume = totalVolume / assets.length;
        metrics.bidAskRatio = totalBidAskRatio / assets.length;

        return metrics;
    }

    /**
     * Get dashboard data
     */
    getDashboard() {
        return {
            ...this.dashboard,
            metrics: this.metrics,
            history: this.history
        };
    }

    /**
     * Get specific chart data
     */
    getChart(chartType, timeframe = '1h') {
        const charts = this.dashboard.charts;

        switch (chartType) {
            case 'portfolio':
                return this.filterByTimeframe(charts.portfolioValue, timeframe);
            case 'pnl':
                return this.filterByTimeframe(charts.pnl, timeframe);
            case 'drawdown':
                return this.filterByTimeframe(charts.drawdown, timeframe);
            case 'performance':
                return charts.performance;
            case 'returnsDistribution':
                return charts.returnsDistribution;
            case 'volatility':
                return this.filterByTimeframe(charts.volatility, timeframe);
            case 'sharpeRatio':
                return this.filterByTimeframe(charts.sharpeRatio, timeframe);
            case 'winLossRatio':
                return charts.winLossRatio;
            case 'riskAdjustedReturns':
                return charts.riskAdjustedReturns;
            case 'correlationHeatmap':
                return charts.correlationHeatmap;
            case 'performanceAttribution':
                return charts.performanceAttribution;
            default:
                return null;
        }
    }

    /**
     * Filter data by timeframe
     */
    filterByTimeframe(data, timeframe) {
        if (!data || !data.labels || data.labels.length === 0) {
            // Return empty data structure if no data available
            return { labels: [], data: [] };
        }

        const now = new Date();
        const timeframeMs = this.getTimeframeMs(timeframe);
        const cutoff = now.getTime() - timeframeMs;

        const filteredLabels = [];
        const filteredData = [];

        for (let i = 0; i < data.labels.length; i++) {
            const timestamp = new Date(data.labels[i]).getTime();
            if (timestamp >= cutoff) {
                filteredLabels.push(data.labels[i]);
                filteredData.push(data.data[i]);
            }
        }

        // If no data within timeframe, return all available data
        if (filteredLabels.length === 0) {
            return {
                labels: data.labels,
                data: data.data
            };
        }

        return {
            labels: filteredLabels,
            data: filteredData
        };
    }

    /**
     * Get timeframe in milliseconds
     */
    getTimeframeMs(timeframe) {
        const timeframes = {
            '1m': 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '1w': 7 * 24 * 60 * 60 * 1000
        };

        return timeframes[timeframe] || timeframes['1h'];
    }

    /**
     * Export dashboard data
     */
    exportData(format = 'json') {
        const data = this.getDashboard();

        switch (format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertToCSV(data);
            default:
                return data;
        }
    }

    /**
     * Convert data to CSV format
     */
    convertToCSV(data) {
        // Enhanced CSV conversion with new metrics
        const csv = [];

        // Portfolio data
        csv.push('Portfolio Data');
        csv.push('Total Value,Cash,Margin Used,Positions');
        csv.push(`${data.portfolio.totalValue},${data.portfolio.cash},${data.portfolio.marginUsed},${data.portfolio.positions}`);

        // Performance data
        csv.push('\nPerformance Data');
        csv.push('Total Trades,Winning Trades,Losing Trades,Total P&L,Win Rate,Sharpe Ratio,Max Drawdown,Volatility');
        csv.push(`${data.performance.totalTrades},${data.performance.winningTrades},${data.performance.losingTrades},${data.performance.totalPnL},${data.performance.winRate},${data.performance.sharpeRatio},${data.performance.maxDrawdown},${data.performance.volatility}`);

        // Risk metrics
        csv.push('\nRisk Metrics');
        csv.push('Value at Risk,Expected Shortfall');
        csv.push(`${data.risk.valueAtRisk},${data.risk.expectedShortfall}`);

        // Market data
        csv.push('\nMarket Data');
        csv.push('Market Sentiment,Volatility Index');
        csv.push(`${data.market.marketSentiment},${data.market.volatilityIndex}`);

        return csv.join('\n');
    }

    /**
     * Stop data collection
     */
    stop() {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stop();
        this.removeAllListeners();
    }
}

module.exports = AnalyticsDashboard;
