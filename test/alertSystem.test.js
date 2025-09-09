/**
 * Alert System Tests
 */

const { expect } = require('chai');
const AlertSystem = require('../src/alertSystem');
const fs = require('fs').promises;
const path = require('path');

describe('Alert System', function () {
    let alertSystem;
    const testConfig = {
        errorRateThreshold: 0.05,
        responseTimeThreshold: 5000,
        memoryUsageThreshold: 0.8,
        cpuUsageThreshold: 0.9,
        diskSpaceThreshold: 0.9,
        webhookUrl: null
    };

    beforeEach(async function () {
        alertSystem = new AlertSystem(testConfig);
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    afterEach(async function () {
        if (alertSystem) {
            alertSystem.stopMonitoring();
            // Clean up log files
            try {
                const logsDir = path.join(__dirname, '../logs');
                const files = await fs.readdir(logsDir);
                for (const file of files) {
                    if (file.endsWith('.log')) {
                        await fs.unlink(path.join(logsDir, file));
                    }
                }
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });

    describe('Initialization', function () {
        it('should initialize with correct configuration', function () {
            expect(alertSystem.config).to.deep.equal(testConfig);
            expect(alertSystem.alerts).to.be.an('array');
            expect(alertSystem.thresholds).to.be.an('object');
        });

        it('should create logs directory', async function () {
            const logsDir = path.dirname(alertSystem.logFile);
            const exists = await fs.access(logsDir).then(() => true).catch(() => false);
            expect(exists).to.be.true;
        });
    });

    describe('Alert Logging', function () {
        it('should log general alerts', async function () {
            const alert = await alertSystem.logAlert('INFO', 'Test alert', { test: true });

            expect(alert).to.be.an('object');
            expect(alert.level).to.equal('INFO');
            expect(alert.message).to.equal('Test alert');
            expect(alert.data).to.deep.equal({ test: true });
            expect(alert.id).to.be.a('string');
        });

        it('should log errors with stack trace', async function () {
            const testError = new Error('Test error');
            testError.testProperty = 'test value';

            const alert = await alertSystem.logAlert('ERROR', 'Test error message', {
                error: testError,
                context: 'test'
            });

            expect(alert.level).to.equal('ERROR');
            expect(alert.message).to.equal('Test error message');
            expect(alert.data.error.message).to.equal('Test error');
            expect(alert.data.context).to.equal('test');
        });

        it('should log performance metrics', async function () {
            const metric = await alertSystem.logPerformance('response_time', 1000, { endpoint: '/test' });

            expect(metric).to.be.an('object');
            expect(metric.metric).to.equal('response_time');
            expect(metric.value).to.equal(1000);
            expect(metric.context).to.deep.equal({ endpoint: '/test' });
        });

        it('should trigger alerts for threshold breaches', async function () {
            // Test response time threshold breach
            await alertSystem.logPerformance('response_time', 6000, { endpoint: '/slow' });

            const alerts = alertSystem.getActiveAlerts('WARNING');
            expect(alerts.length).to.be.greaterThan(0);
            expect(alerts[0].message).to.include('Performance threshold exceeded');
        });
    });

    describe('Alert Management', function () {
        beforeEach(async function () {
            // Add some test alerts
            await alertSystem.logAlert('INFO', 'Alert 1');
            await alertSystem.logAlert('WARNING', 'Alert 2');
            await alertSystem.logAlert('ERROR', 'Alert 3');
        });

        it('should retrieve active alerts', function () {
            const allAlerts = alertSystem.getActiveAlerts();
            expect(allAlerts.length).to.equal(3);

            const errorAlerts = alertSystem.getActiveAlerts('ERROR');
            expect(errorAlerts.length).to.equal(1);
            expect(errorAlerts[0].level).to.equal('ERROR');
        });

        it('should clear old alerts', function () {
            // Set a very short max age for testing
            alertSystem.clearOldAlerts(1); // 1ms ago
            const alerts = alertSystem.getActiveAlerts();
            expect(alerts.length).to.equal(0);
        });

        it('should generate alert statistics', function () {
            const stats = alertSystem.getAlertStats();

            expect(stats).to.be.an('object');
            expect(stats.total).to.equal(3);
            expect(stats.byLevel).to.have.property('INFO', 1);
            expect(stats.byLevel).to.have.property('WARNING', 1);
            expect(stats.byLevel).to.have.property('ERROR', 1);
            expect(stats.recent).to.be.an('array');
        });
    });

    describe('System Health Monitoring', function () {
        it('should monitor system health', async function () {
            await alertSystem.monitorSystemHealth();

            // Check if metrics were recorded
            expect(alertSystem.metrics.memory_usage).to.be.an('array');
            expect(alertSystem.metrics.cpu_usage).to.be.an('array');
        });

        it('should start and stop monitoring', function () {
            alertSystem.startMonitoring(1000); // 1 second interval
            expect(alertSystem.monitoringInterval).to.not.be.null;

            alertSystem.stopMonitoring();
            expect(alertSystem.monitoringInterval).to.be.null;
        });
    });

    describe('Threshold Checking', function () {
        it('should check response time threshold', function () {
            expect(alertSystem.checkThresholds('response_time', 4000)).to.be.false;
            expect(alertSystem.checkThresholds('response_time', 6000)).to.be.true;
        });

        it('should check memory usage threshold', function () {
            expect(alertSystem.checkThresholds('memory_usage', 0.7)).to.be.false;
            expect(alertSystem.checkThresholds('memory_usage', 0.9)).to.be.true;
        });

        it('should check CPU usage threshold', function () {
            expect(alertSystem.checkThresholds('cpu_usage', 0.8)).to.be.false;
            expect(alertSystem.checkThresholds('cpu_usage', 0.95)).to.be.true;
        });

        it('should return false for unknown metrics', function () {
            expect(alertSystem.checkThresholds('unknown_metric', 100)).to.be.false;
        });
    });

    describe('File Logging', function () {
        it('should log to file', async function () {
            const testData = { test: 'data', timestamp: new Date() };
            await alertSystem.logToFile(testData);

            // Check if file exists and contains data
            const exists = await fs.access(alertSystem.logFile).then(() => true).catch(() => false);
            expect(exists).to.be.true;

            const content = await fs.readFile(alertSystem.logFile, 'utf8');
            expect(content).to.include('test');
            expect(content).to.include('data');
        });

        it('should handle file logging errors gracefully', async function () {
            // Try to log to a directory that doesn't exist
            const invalidPath = '/invalid/path/log.txt';
            await alertSystem.logToFile({ test: 'data' }, invalidPath);

            // Should not throw error
            expect(true).to.be.true;
        });
    });

    describe('Webhook Integration', function () {
        it('should not send webhook when URL is not configured', async function () {
            const alert = await alertSystem.logAlert('INFO', 'Test webhook');
            // Should complete without error
            expect(alert).to.be.an('object');
        });

        it('should handle webhook errors gracefully', async function () {
            // Set invalid webhook URL
            alertSystem.config.webhookUrl = 'http://invalid-url-that-does-not-exist.com';

            const alert = await alertSystem.logAlert('INFO', 'Test webhook error');
            // Should complete without throwing
            expect(alert).to.be.an('object');
        });
    });

    describe('Utility Methods', function () {
        it('should generate unique alert IDs', function () {
            const id1 = alertSystem.generateAlertId();
            const id2 = alertSystem.generateAlertId();

            expect(id1).to.be.a('string');
            expect(id2).to.be.a('string');
            expect(id1).to.not.equal(id2);
        });

        it('should provide log prefix', function () {
            const prefix = alertSystem.logPrefix();
            expect(prefix).to.be.a('string');
            expect(prefix).to.include(new Date().getFullYear().toString());
        });
    });
});
