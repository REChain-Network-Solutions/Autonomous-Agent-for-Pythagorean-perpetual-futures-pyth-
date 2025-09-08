'use strict'

require('dotenv').config()

const config = {
	port: process.env.PORT || 3000,
	adminToken: process.env.ADMIN_TOKEN || '',
	metricsFile: process.env.METRICS_FILE || '',
	metricsProvider: process.env.METRICS_PROVIDER || 'inmemory', // inmemory|file|aa-stub
	aaAddresses: (process.env.AA_ADDRESSES || '').split(',').filter(Boolean),
	sessionSecret: process.env.SESSION_SECRET || 'dev-secret',
	sessionTTL: +(process.env.SESSION_TTL || 86400),
	aaHttpUrl: process.env.AA_HTTP_URL || '',
	aaPollMs: +(process.env.AA_POLL_MS || 10000),
	webhookOnTick: (process.env.WEBHOOK_ON_TICK || 'false').toLowerCase() === 'true',
	webhookSecret: process.env.WEBHOOK_SECRET || '',
	webhookMaxRetries: +(process.env.WEBHOOK_MAX_RETRIES || 3),
	webhookRetryDelayMs: +(process.env.WEBHOOK_RETRY_DELAY_MS || 2000),
}

module.exports = config


