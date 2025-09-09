/**
 * Advanced Alert System
 * Implements comprehensive logging, error tracking, and automated alerts
 */

const fs = require('fs').promises;
const path = require('path');

class AlertSystem {
    constructor(config) {
        this.config = config;
        this.alerts = [];
        this.logFile = path.join(__dirname, '../logs/alerts.log');
        this.errorLogFile = path.join(__dirname, '../logs/errors.log');
        this.performanceLogFile = path.join(__dirname, '../logs/performance.log');

        // Ensure logs directory exists
        this.ensureLogsDirectory();

        // Initialize metrics storage
        this.metrics = {
            memory_usage: [],
            cpu_usage: [],
            response_time: [],
            error_rate: []
        };

        // Alert thresholds
        this.thresholds = {
            errorRate: config.errorRateThreshold || 0.05, // 5% error rate
            responseTime: config.responseTimeThreshold || 5000, // 5 seconds
            memoryUsage: config.memoryUsageThreshold || 0.8, // 80% memory usage
            cpuUsage: config.cpuUsageThreshold || 0.9, // 90% CPU usage
            diskSpace: config.diskSpaceThreshold || 0.9 // 90% disk usage
        };

        // Alert channels
        this.channels = {
            console: true,
            file: true,
            webhook: config.webhookUrl ? true : false,
            email: config.emailConfig ? true : false
        };
    }

    /**
     * Ensure logs directory exists
     */
    async ensureLogsDirectory() {
        const logsDir = path.dirname(this.logFile);
        try {
            await fs.access(logsDir);
        } catch {
            await fs.mkdir(logsDir, { recursive: true });
        }
    }

    /**
     * Log general alert
     */
    async logAlert(level, message, data = {}) {
        const alert = {
            id: this.generateAlertId(),
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message,
            data,
            source: 'alert_system'
        };

        this.alerts.push(alert);

        // Keep only last 100 alerts in memory
        if (this.alerts.length > 100) {
            this.alerts.shift();
        }

        // Log to console
        if (this.channels.console) {
            console.log(`[${alert.level}] ${alert.timestamp}: ${alert.message}`);
        }

        // Log to file
        if (this.channels.file) {
            await this.logToFile(alert);
        }

        // Send webhook if configured
        if (this.channels.webhook) {
            await this.sendWebhook(alert);
        }

        return alert;
    }

    /**
     * Log error with stack trace
     */
    async logError(error, context = {}) {
        const errorData = {
            message: error.message,
            stack: error.stack,
            name: error.name,
            context
        };

        await this.logAlert('ERROR', error.message, errorData);
        await this.logToFile(errorData, this.errorLogFile);
    }

    /**
     * Log performance metrics
     */
    async logPerformance(metric, value, context = {}) {
        const perfData = {
            metric,
            value,
            context,
            timestamp: new Date().toISOString()
        };

        // Store metric in memory
        if (this.metrics[metric]) {
            this.metrics[metric].push({
                value,
                timestamp: perfData.timestamp,
                context
            });

            // Keep only last 100 metrics per type
            if (this.metrics[metric].length > 100) {
                this.metrics[metric].shift();
            }
        }

        // Check thresholds and alert if exceeded
        if (this.checkThresholds(metric, value)) {
            await this.logAlert('WARNING', `Performance threshold exceeded: ${metric} = ${value}`, perfData);
        }

        await this.logToFile(perfData, this.performanceLogFile);

        return perfData;
    }

    /**
     * Get log prefix for logging
     */
    logPrefix() {
        const now = new Date();
        return `[${now.toISOString()}] ALERT_SYSTEM`;
    }

    /**
     * Check if metric exceeds thresholds
     */
    checkThresholds(metric, value) {
        switch (metric) {
            case 'response_time':
                return value > this.thresholds.responseTime;
            case 'memory_usage':
                return value > this.thresholds.memoryUsage;
            case 'cpu_usage':
                return value > this.thresholds.cpuUsage;
            case 'disk_usage':
                return value > this.thresholds.diskSpace;
            case 'error_rate':
                return value > this.thresholds.errorRate;
            default:
                return false;
        }
    }

    /**
     * Log to file
     */
    async logToFile(data, filePath = this.logFile) {
        try {
            const logEntry = JSON.stringify(data) + '\n';
            await fs.appendFile(filePath, logEntry);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    /**
     * Send webhook notification
     */
    async sendWebhook(alert) {
        if (!this.config.webhookUrl) return;

        try {
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: `Alert: ${alert.level} - ${alert.message}`,
                    data: alert
                })
            });

            if (!response.ok) {
                console.error('Webhook failed:', response.status);
            }
        } catch (error) {
            console.error('Webhook error:', error);
        }
    }

    /**
     * Generate unique alert ID
     */
    generateAlertId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Get active alerts
     */
    getActiveAlerts(level = null) {
        let alerts = this.alerts;
        if (level) {
            alerts = alerts.filter(alert => alert.level === level.toUpperCase());
        }
        return alerts;
    }

    /**
     * Clear old alerts
     */
    clearOldAlerts(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
        const cutoff = Date.now() - maxAge;
        this.alerts = this.alerts.filter(alert => new Date(alert.timestamp).getTime() > cutoff);
    }

    /**
     * Get alert statistics
     */
    getAlertStats() {
        const stats = {
            total: this.alerts.length,
            byLevel: {},
            recent: []
        };

        // Count by level
        this.alerts.forEach(alert => {
            stats.byLevel[alert.level] = (stats.byLevel[alert.level] || 0) + 1;
        });

        // Get recent alerts (last hour)
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        stats.recent = this.alerts.filter(alert =>
            new Date(alert.timestamp).getTime() > oneHourAgo
        );

        return stats;
    }

    /**
     * Monitor system health
     */
    async monitorSystemHealth() {
        try {
            // Memory usage
            const memUsage = process.memoryUsage();
            const memoryUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
            await this.logPerformance('memory_usage', memoryUsagePercent);

            // CPU usage (simplified)
            const cpuUsage = process.cpuUsage();
            const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Rough percentage
            await this.logPerformance('cpu_usage', cpuPercent);

            // Disk space (if available)
            // This would require additional dependencies for cross-platform disk monitoring

        } catch (error) {
            await this.logError(error, { context: 'system_health_monitor' });
        }
    }

    /**
     * Start monitoring interval
     */
    startMonitoring(interval = 60000) { // 1 minute default
        this.monitoringInterval = setInterval(() => {
            this.monitorSystemHealth();
            this.clearOldAlerts();
        }, interval);
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
}

module.exports = AlertSystem;
