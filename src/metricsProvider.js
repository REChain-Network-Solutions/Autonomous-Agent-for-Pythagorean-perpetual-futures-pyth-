'use strict'

class InMemoryMetricsProvider {
	constructor() {
		this.state = {
			uptimeStartedAt: Date.now(),
			positions: [],
			performance: { pnl: 0, trades: 0 },
			ready: true,
		}
	}

	getStatus() {
		return { ok: true, uptimeMs: Date.now() - this.state.uptimeStartedAt }
	}

	getPositions() { return { positions: this.state.positions } }

	getPerformance() { return this.state.performance }

	triggerRebalance() { this.state.performance.trades += 1; return { ok: true } }
}

const fs = require('fs')

class FileMetricsProvider {
	constructor(filePath) {
		this.filePath = filePath
		this.ensureFile()
	}

	ensureFile() {
		if (!fs.existsSync(this.filePath)) {
			const initial = {
				uptimeStartedAt: Date.now(),
				positions: [],
				performance: { pnl: 0, trades: 0 }
			}
			fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2))
		}
	}

	read() {
		try {
			const raw = fs.readFileSync(this.filePath, 'utf8')
			return JSON.parse(raw)
		} catch (e) {
			return { uptimeStartedAt: Date.now(), positions: [], performance: { pnl: 0, trades: 0 } }
		}
	}

	write(data) {
		fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2))
	}

	getStatus() {
		const s = this.read()
		return { ok: true, uptimeMs: Date.now() - (s.uptimeStartedAt || Date.now()) }
	}

	getPositions() { return { positions: this.read().positions || [] } }

	getPerformance() { return this.read().performance || { pnl: 0, trades: 0 } }

	triggerRebalance() {
		const s = this.read()
		s.performance = s.performance || { pnl: 0, trades: 0 }
		s.performance.trades += 1
		this.write(s)
		return { ok: true }
	}

	update(partial) {
		const s = this.read()
		const merged = { ...s, ...partial }
		this.write(merged)
		return merged
	}
}

class AaStubMetricsProvider {
	constructor(opts = {}) {
		this.opts = opts
		this.state = {
			addresses: opts.addresses || [],
			lastFetch: 0,
			positions: [],
			performance: { pnl: 0, trades: 0 },
			uptimeStartedAt: Date.now(),
		}
	}

	getStatus() { return { ok: true, uptimeMs: Date.now() - this.state.uptimeStartedAt } }
	getPositions() { return { positions: this.state.positions } }
	getPerformance() { return this.state.performance }
	triggerRebalance() { this.state.performance.trades += 1; return { ok: true } }

	update(partial) { this.state = { ...this.state, ...partial }; return this.state }
}

class AaHttpMetricsProvider {
	constructor(opts) {
		this.url = opts.url
		this.addresses = opts.addresses || []
		this.pollMs = opts.pollMs || 10000
		this.cache = { uptimeStartedAt: Date.now(), positions: [], performance: { pnl: 0, trades: 0 } }
		this.timer = null
		this.fetch = (typeof fetch === 'function') ? fetch : (...args) => import('node-fetch').then(({default: f}) => f(...args))
		this.start()
	}

	start() {
		this.stop()
		this.timer = setInterval(() => { this.refresh().catch(() => {}) }, this.pollMs)
		this.refresh().catch(() => {})
	}

	stop() { if (this.timer) { clearInterval(this.timer); this.timer = null } }

	async refresh() {
		if (!this.url) return
		try {
			const q = new URLSearchParams()
			for (const a of this.addresses) q.append('aa', a)
			const r = await this.fetch(`${this.url.replace(/\/$/, '')}/state?${q.toString()}`)
			if (!r.ok) return
			const data = await r.json()
			this.cache = {
				uptimeStartedAt: this.cache.uptimeStartedAt,
				positions: data.positions || [],
				performance: data.performance || this.cache.performance,
			}
		} catch (_) {}
	}

	getStatus() { return { ok: true, uptimeMs: Date.now() - this.cache.uptimeStartedAt } }
	getPositions() { return { positions: this.cache.positions } }
	getPerformance() { return this.cache.performance }
	triggerRebalance() { return { ok: false, message: 'not supported via metrics provider' } }
}

module.exports = { InMemoryMetricsProvider, FileMetricsProvider, AaStubMetricsProvider, AaHttpMetricsProvider }


