'use strict'

const express = require('express')
const crypto = require('crypto')
const cors = require('cors')
const config = require('./config')
const { InMemoryMetricsProvider, FileMetricsProvider, AaStubMetricsProvider, AaHttpMetricsProvider } = require('./metricsProvider')

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(express.static(require('path').join(process.cwd(), 'public')))
// swagger ui
try {
    const swaggerUi = require('swagger-ui-express')
    const fs = require('fs')
    const yaml = require('yaml')
    const spec = yaml.parse(fs.readFileSync(require('path').join(process.cwd(), 'openapi.yaml'), 'utf8'))
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec))
} catch (_) {}

let metrics
if (config.metricsProvider === 'file' && config.metricsFile) {
	metrics = new FileMetricsProvider(config.metricsFile)
} else if (config.metricsProvider === 'aa-stub') {
	metrics = new AaStubMetricsProvider({ addresses: config.aaAddresses })
} else if (config.metricsProvider === 'aa-http' && config.aaHttpUrl) {
	metrics = new AaHttpMetricsProvider({ url: config.aaHttpUrl, addresses: config.aaAddresses, pollMs: config.aaPollMs })
} else {
	metrics = new InMemoryMetricsProvider()
}

// simple webhook registry (in-memory)
const webhooks = new Set()
async function notifyHooks(event, payload) {
    if (!webhooks.size) return
    try {
        const fetchFn = (typeof fetch === 'function') ? fetch : (...args) => import('node-fetch').then(({default: f}) => f(...args))
        const id = crypto.randomBytes(16).toString('hex')
        const body = JSON.stringify(payload)
        const ts = Date.now().toString()
        const headers = { 'content-type': 'application/json', 'x-event': event, 'x-id': id, 'x-ts': ts }
        if (config.webhookSecret) {
            const hmac = crypto.createHmac('sha256', config.webhookSecret).update(id + ts + body).digest('hex')
            headers['x-signature'] = 'sha256=' + hmac
        }
        await Promise.all(Array.from(webhooks).map(async (url) => {
            let attempt = 0
            while (attempt <= config.webhookMaxRetries) {
                try {
                    const r = await fetchFn(url, { method: 'POST', headers, body })
                    if (r.ok) break
                } catch (_) {}
                attempt++
                if (attempt <= config.webhookMaxRetries)
                    await new Promise(res => setTimeout(res, config.webhookRetryDelayMs))
            }
        }))
    } catch (_) {}
}

// health/readiness
app.get('/healthz', (req, res) => res.json({ ok: true }))
app.get('/readyz', (req, res) => res.json({ ready: true }))

// metrics
app.get('/metrics/status', (req, res) => res.json(metrics.getStatus()))
app.get('/metrics/positions', (req, res) => res.json(metrics.getPositions()))
app.get('/metrics/performance', (req, res) => res.json(metrics.getPerformance()))

// server-sent events stream for live metrics updates
app.get('/metrics/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    const send = () => {
        const data = {
            status: metrics.getStatus(),
            positions: metrics.getPositions(),
            performance: metrics.getPerformance(),
        }
        res.write(`event: metrics\n`)
        res.write(`data: ${JSON.stringify(data)}\n\n`)
    }
    const t = setInterval(() => {
        send()
        if (config.webhookOnTick) {
            notifyHooks('metrics.tick', { at: Date.now(), performance: metrics.getPerformance() })
        }
    }, 5000)
    send()
    req.on('close', () => clearInterval(t))
})

// sessions (simple in-memory)
const sessions = new Map() // sessionId -> { roles, wallet, did, exp }

function createSession(data) {
	const sid = crypto.randomBytes(16).toString('hex')
	const exp = Date.now() + config.sessionTTL * 1000
	sessions.set(sid, { ...data, exp })
	return { sid, exp }
}

function getSession(req) {
	const sid = req.headers['x-session-id']
	if (!sid) return null
	const s = sessions.get(String(sid))
	if (!s) return null
	if (s.exp < Date.now()) { sessions.delete(String(sid)); return null }
	return s
}

function requireRole(role) {
	return (req, res, next) => {
		const s = getSession(req)
		if (!s || !Array.isArray(s.roles) || !s.roles.includes(role))
			return res.status(401).json({ ok: false })
		next()
	}
}

// admin auth: accepts either ADMIN_TOKEN header or session role
function requireAdmin(req, res, next) {
	if (config.adminToken && req.headers['x-admin-token'] === config.adminToken) return next()
	return requireRole('admin')(req, res, next)
}

app.post('/admin/trigger-rebalance', requireAdmin, (req, res) => {
	metrics.triggerRebalance()
	const payload = { at: Date.now(), type: 'rebalance', performance: metrics.getPerformance() }
	notifyHooks('rebalance', payload)
	res.json({ ok: true, message: 'rebalance triggered' })
})

// optional manual refresh for AA HTTP provider
app.post('/admin/refresh-metrics', requireAdmin, async (req, res) => {
	if (typeof metrics.refresh === 'function') {
		await metrics.refresh()
		notifyHooks('metrics.refresh', { at: Date.now() })
		return res.json({ ok: true })
	}
	res.status(400).json({ ok: false, message: 'refresh not supported' })
})

// test helper to update metrics manually
app.post('/admin/update-metrics', requireAdmin, (req, res) => {
	const body = req.body || {}
	if (typeof metrics.update === 'function') {
		const updated = metrics.update(body)
		notifyHooks('metrics.update', { at: Date.now(), updated })
		return res.json({ ok: true, updated })
	}
	res.status(400).json({ ok: false, message: 'update not supported' })
})

const server = app.listen(config.port, () => {
	console.log(`Server listening on :${config.port}`)
})

// graceful shutdown
function shutdown() {
	server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)


// web3 wallet auth (nonce + EIP-191 verify)
const walletSessions = new Map()

function generateNonce() {
	return crypto.randomBytes(16).toString('hex')
}

app.get('/web3/nonce', (req, res) => {
	const nonce = generateNonce()
	const id = generateNonce()
	walletSessions.set(id, { nonce, createdAt: Date.now() })
	res.json({ id, nonce })
})

app.post('/web3/verify', async (req, res) => {
	try {
		const { id, address, signature, message } = req.body || {}
		if (!id || !address || !signature || !message)
			return res.status(400).json({ ok: false })
		const sess = walletSessions.get(id)
		if (!sess) return res.status(400).json({ ok: false, message: 'no session' })
		if (!message.includes(sess.nonce)) return res.status(400).json({ ok: false, message: 'bad nonce' })
		const { ethers } = require('ethers')
		const recovered = ethers.verifyMessage(message, signature)
		if (recovered.toLowerCase() !== String(address).toLowerCase())
			return res.status(401).json({ ok: false })
		walletSessions.set(id, { ...sess, address, verifiedAt: Date.now() })
		const { sid, exp } = createSession({ roles: ['user'], wallet: address })
		notifyHooks('auth.web3', { at: Date.now(), wallet: address })
		return res.json({ ok: true, sessionId: sid, exp })
	} catch (_) {
		return res.status(400).json({ ok: false })
	}
})

// DID/Web5 stub auth
app.post('/did/verify', (req, res) => {
	const { did, proof } = req.body || {}
	if (!did || !proof) return res.status(400).json({ ok: false })
	// accept any for stub; later verify with did resolver/VC
	const { sid, exp } = createSession({ roles: ['user'], did })
	notifyHooks('auth.did', { at: Date.now(), did })
	return res.json({ ok: true, sessionId: sid, exp })
})

// elevate role (admin) — protected by ADMIN_TOKEN only
app.post('/admin/elevate', (req, res) => {
	if (!config.adminToken || req.headers['x-admin-token'] !== config.adminToken)
		return res.status(401).json({ ok: false })
	const { sessionId } = req.body || {}
	const s = sessionId && sessions.get(String(sessionId))
	if (!s) return res.status(400).json({ ok: false })
	s.roles = Array.from(new Set([...(s.roles || []), 'admin']))
	return res.json({ ok: true })
})

// webhook admin endpoints
app.post('/admin/hooks', requireAdmin, (req, res) => {
    const { url } = req.body || {}
    try { new URL(String(url)) } catch (_) { return res.status(400).json({ ok: false }) }
    webhooks.add(String(url))
    res.json({ ok: true, size: webhooks.size })
})

app.delete('/admin/hooks', requireAdmin, (req, res) => {
    const { url } = req.body || {}
    if (url) webhooks.delete(String(url))
    res.json({ ok: true, size: webhooks.size })
})

// generic admin emit for testing
app.post('/admin/emit', requireAdmin, async (req, res) => {
    const { event, payload } = req.body || {}
    if (!event) return res.status(400).json({ ok: false })
    await notifyHooks(String(event), payload || {})
    res.json({ ok: true })
})

// list current hooks
app.get('/admin/hooks', requireAdmin, (req, res) => {
    res.json({ ok: true, hooks: Array.from(webhooks) })
})

// view current config (safe subset)
app.get('/admin/config', requireAdmin, (req, res) => {
    const safe = {
        port: config.port,
        metricsProvider: config.metricsProvider,
        aaHttpUrl: !!config.aaHttpUrl,
        aaPollMs: config.aaPollMs,
        webhookOnTick: config.webhookOnTick,
        webhookMaxRetries: config.webhookMaxRetries,
        webhookRetryDelayMs: config.webhookRetryDelayMs,
    }
    res.json({ ok: true, config: safe })
})

// list sessions (only meta)
app.get('/admin/sessions', requireAdmin, (req, res) => {
    const list = []
    sessions.forEach((v, k) => list.push({ id: k, roles: v.roles, exp: v.exp, wallet: v.wallet ? 'yes' : undefined, did: v.did ? 'yes' : undefined }))
    res.json({ ok: true, sessions: list })
})

// delete session
app.delete('/admin/sessions', requireAdmin, (req, res) => {
    const { sessionId } = req.body || {}
    if (!sessionId) return res.status(400).json({ ok: false })
    sessions.delete(String(sessionId))
    res.json({ ok: true })
})

