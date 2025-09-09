/**
 * Main Application Entry Point
 * Autonomous Agent for Pythagorean Perpetual Futures Trading
 */

const AlertSystem = require('./alertSystem');
const TradingEngine = require('./tradingEngine');
const AnalyticsDashboard = require('./analyticsDashboard');
const RiskManager = require('./riskManager');
const EnhancedServer = require('./enhancedServer');

class AutonomousAgent {
    constructor(config) {
        this.config = {
            // Server configuration
            port: 3000,
            apiKey: process.env.API_KEY || 'your-api-key-here',
            corsOrigins: ['http://localhost:3000', 'http://localhost:3001'],

            // Trading configuration
            initialCash: 100000,
            maxPositionSize: 0.1,
            maxDrawdown: 0.2,
            stopLossPercent: 0.05,
            takeProfitPercent: 0.1,
            leverage: 1,
            minOrderSize: 10,
            maxOrdersPerAsset: 3,

            // Risk management
            maxDailyLoss: 0.1,
            maxLeverage: 5,
            maxConcentration: 0.25,
            varLimit: 0.15,
            stressTestThreshold: 0.3,
            correlationLimit: 0.8,
            liquidityThreshold: 0.7,

            // Alert system
            errorRateThreshold: 0.05,
            responseTimeThreshold: 5000,
            memoryUsageThreshold: 0.8,
            cpuUsageThreshold: 0.9,
            diskSpaceThreshold: 0.9,
            webhookUrl: process.env.WEBHOOK_URL,

            // Analytics
            refreshInterval: 5000,
            maxHistoryPoints: 1000,
            monitoringInterval: 30000,

            ...config
        };

        this.components = {};
        this.isRunning = false;
    }

    /**
     * Initialize all components
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Autonomous Agent...');

            // Initialize Alert System
            console.log('📊 Initializing Alert System...');
            this.components.alertSystem = new AlertSystem({
                errorRateThreshold: this.config.errorRateThreshold,
                responseTimeThreshold: this.config.responseTimeThreshold,
                memoryUsageThreshold: this.config.memoryUsageThreshold,
                cpuUsageThreshold: this.config.cpuUsageThreshold,
                diskSpaceThreshold: this.config.diskSpaceThreshold,
                webhookUrl: this.config.webhookUrl
            });

            // Initialize Trading Engine
            console.log('📈 Initializing Trading Engine...');
            this.components.tradingEngine = new TradingEngine({
                initialCash: this.config.initialCash,
                maxPositionSize: this.config.maxPositionSize,
                maxDrawdown: this.config.maxDrawdown,
                stopLossPercent: this.config.stopLossPercent,
                takeProfitPercent: this.config.takeProfitPercent,
                leverage: this.config.leverage,
                minOrderSize: this.config.minOrderSize,
                maxOrdersPerAsset: this.config.maxOrdersPerAsset
            }, this.components.alertSystem);

            // Initialize Analytics Dashboard
            console.log('📊 Initializing Analytics Dashboard...');
            this.components.analyticsDashboard = new AnalyticsDashboard({
                refreshInterval: this.config.refreshInterval,
                maxHistoryPoints: this.config.maxHistoryPoints
            }, this.components.tradingEngine, this.components.alertSystem);

            // Initialize Risk Manager
            console.log('⚠️  Initializing Risk Manager...');
            this.components.riskManager = new RiskManager({
                maxDrawdown: this.config.maxDrawdown,
                maxDailyLoss: this.config.maxDailyLoss,
                maxPositionSize: this.config.maxPositionSize,
                maxLeverage: this.config.maxLeverage,
                maxConcentration: this.config.maxConcentration,
                varLimit: this.config.varLimit,
                stressTestThreshold: this.config.stressTestThreshold,
                correlationLimit: this.config.correlationLimit,
                liquidityThreshold: this.config.liquidityThreshold,
                monitoringInterval: this.config.monitoringInterval
            }, this.components.tradingEngine, this.components.alertSystem);

            // Initialize API Server
            console.log('🌐 Initializing API Server...');
            this.components.server = new EnhancedServer(
                {
                    port: this.config.port,
                    apiKey: this.config.apiKey,
                    corsOrigins: this.config.corsOrigins
                },
                this.components.tradingEngine,
                this.components.alertSystem,
                this.components.analyticsDashboard,
                this.components.riskManager
            );

            console.log('✅ All components initialized successfully!');

        } catch (error) {
            console.error('❌ Failed to initialize components:', error);
            await this.components.alertSystem?.logError(error, { context: 'initialization' });
            throw error;
        }
    }

    /**
     * Start the autonomous agent
     */
    async start() {
        try {
            if (this.isRunning) {
                console.log('⚠️  Agent is already running');
                return;
            }

            console.log('🚀 Starting Autonomous Agent...');

            // Start API server
            await this.components.server.start();

            // Start monitoring systems
            this.components.alertSystem.startMonitoring();
            this.components.analyticsDashboard.startDataCollection();
            this.components.riskManager.startMonitoring();

            this.isRunning = true;

            await this.components.alertSystem.logAlert('INFO', 'Autonomous Agent started successfully', {
                components: Object.keys(this.components),
                config: {
                    port: this.config.port,
                    initialCash: this.config.initialCash,
                    maxDrawdown: this.config.maxDrawdown
                }
            });

            console.log('🎉 Autonomous Agent is now running!');
            console.log(`📊 Dashboard: http://localhost:${this.config.port}/api-docs`);
            console.log(`🔗 API: http://localhost:${this.config.port}/api`);
            console.log(`💊 Health: http://localhost:${this.config.port}/health`);

            // Set up graceful shutdown
            this.setupGracefulShutdown();

        } catch (error) {
            console.error('❌ Failed to start agent:', error);
            await this.components.alertSystem?.logError(error, { context: 'startup' });
            throw error;
        }
    }

    /**
     * Stop the autonomous agent
     */
    async stop() {
        try {
            if (!this.isRunning) {
                console.log('⚠️  Agent is not running');
                return;
            }

            console.log('🛑 Stopping Autonomous Agent...');

            // Stop all components
            await this.components.server?.stop();
            this.components.analyticsDashboard?.stop();
            this.components.riskManager?.stopMonitoring();
            this.components.alertSystem?.stopMonitoring();

            // Cleanup components
            Object.values(this.components).forEach(component => {
                if (component.cleanup) {
                    component.cleanup();
                }
            });

            this.isRunning = false;

            await this.components.alertSystem?.logAlert('INFO', 'Autonomous Agent stopped');

            console.log('✅ Autonomous Agent stopped successfully');

        } catch (error) {
            console.error('❌ Error stopping agent:', error);
            await this.components.alertSystem?.logError(error, { context: 'shutdown' });
        }
    }

    /**
     * Get agent status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            uptime: this.isRunning ? process.uptime() : 0,
            components: Object.keys(this.components).reduce((status, name) => {
                const component = this.components[name];
                status[name] = {
                    status: component ? 'active' : 'inactive',
                    info: component?.getInfo ? component.getInfo() : null
                };
                return status;
            }, {}),
            config: {
                port: this.config.port,
                initialCash: this.config.initialCash,
                maxDrawdown: this.config.maxDrawdown,
                leverage: this.config.leverage
            }
        };
    }

    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart

        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            console.error('❌ Uncaught Exception:', error);
            await this.components.alertSystem?.logError(error, { context: 'uncaught_exception' });
            await this.stop();
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', async (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            await this.components.alertSystem?.logError(new Error(reason), { context: 'unhandled_rejection' });
            await this.stop();
            process.exit(1);
        });
    }

    /**
     * Update configuration
     */
    async updateConfig(newConfig) {
        try {
            // Validate configuration
            const validKeys = [
                'port', 'apiKey', 'corsOrigins', 'initialCash', 'maxPositionSize',
                'maxDrawdown', 'stopLossPercent', 'takeProfitPercent', 'leverage',
                'minOrderSize', 'maxOrdersPerAsset', 'maxDailyLoss', 'maxLeverage',
                'maxConcentration', 'varLimit', 'stressTestThreshold', 'correlationLimit',
                'liquidityThreshold', 'errorRateThreshold', 'responseTimeThreshold',
                'memoryUsageThreshold', 'cpuUsageThreshold', 'diskSpaceThreshold',
                'webhookUrl', 'refreshInterval', 'maxHistoryPoints', 'monitoringInterval'
            ];

            const invalidKeys = Object.keys(newConfig).filter(key => !validKeys.includes(key));
            if (invalidKeys.length > 0) {
                throw new Error(`Invalid configuration keys: ${invalidKeys.join(', ')}`);
            }

            // Update configuration
            Object.assign(this.config, newConfig);

            // Update components that need reconfiguration
            if (newConfig.refreshInterval && this.components.analyticsDashboard) {
                this.components.analyticsDashboard.refreshInterval = newConfig.refreshInterval;
            }

            if (newConfig.monitoringInterval && this.components.riskManager) {
                this.components.riskManager.monitoring.interval = newConfig.monitoringInterval;
            }

            await this.components.alertSystem.logAlert('INFO', 'Configuration updated', { newConfig });

            console.log('✅ Configuration updated successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to update configuration:', error);
            await this.components.alertSystem?.logError(error, { context: 'config_update' });
            return false;
        }
    }

    /**
     * Get trading statistics
     */
    getTradingStats() {
        if (!this.components.tradingEngine) {
            return null;
        }

        return this.components.tradingEngine.getStats();
    }

    /**
     * Get risk assessment
     */
    async getRiskAssessment() {
        if (!this.components.riskManager) {
            return null;
        }

        return await this.components.riskManager.performRiskAssessment();
    }

    /**
     * Get analytics data
     */
    getAnalytics() {
        if (!this.components.analyticsDashboard) {
            return null;
        }

        return this.components.analyticsDashboard.getDashboard();
    }

    /**
     * Execute a trade
     */
    async executeTrade(asset, side, size, strategy = 'momentum') {
        if (!this.components.tradingEngine) {
            throw new Error('Trading engine not initialized');
        }

        return await this.components.tradingEngine.executeStrategy(asset, strategy, side);
    }

    /**
     * Emergency stop
     */
    async emergencyStop(reason = 'Manual emergency stop') {
        if (!this.components.riskManager) {
            throw new Error('Risk manager not initialized');
        }

        return await this.components.riskManager.emergencyStop(reason);
    }
}

// Export the class for external use
module.exports = AutonomousAgent;

// If run directly, start the agent
if (require.main === module) {
    const agent = new AutonomousAgent();

    // Handle command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'start':
            agent.initialize()
                .then(() => agent.start())
                .catch(error => {
                    console.error('Failed to start agent:', error);
                    process.exit(1);
                });
            break;

        case 'stop':
            agent.stop()
                .then(() => process.exit(0))
                .catch(error => {
                    console.error('Failed to stop agent:', error);
                    process.exit(1);
                });
            break;

        case 'status':
            console.log(JSON.stringify(agent.getStatus(), null, 2));
            break;

        default:
            console.log('Usage: node main.js [start|stop|status]');
            console.log('  start  - Start the autonomous agent');
            console.log('  stop   - Stop the autonomous agent');
            console.log('  status - Show agent status');
            process.exit(1);
    }
}
