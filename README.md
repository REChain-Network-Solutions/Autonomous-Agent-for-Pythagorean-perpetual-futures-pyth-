# REChain ® Autonomous Agent for Pythagorean Perpetual Futures

This repository hosts a smart agent that performs autonomous perpetual trading using a geometric risk distribution model.

## ✅ Features

- Pythagorean geometric model for risk balance
- Oracle integrations (Katya, Pyth)
- Automated position sizing
- Smart contract execution
- Adaptive strategy switching

## 🧪 Usage

```bash
git clone https://github.com/REChain-Network-Solutions/Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-.git
cd Autonomous-Agent-for-Pythagorean-perpetual-futures-pyth-
npm install
npm start

### Env

Copy `env.example` to `.env` and adjust:

```
cp env.example .env
```

Optional env:

- `ADMIN_TOKEN`: token to access `/admin/*` endpoints (send in `x-admin-token` header)
- `METRICS_FILE`: path to JSON file for persistent metrics (enables file provider)
- `METRICS_PROVIDER`: one of `inmemory` (default), `file`, `aa-stub`
- `AA_ADDRESSES`: comma-separated AA addresses for stub provider
  - also used by `aa-http`
- `AA_HTTP_URL`: base URL of AA state API (for `aa-http` provider), must return JSON with `{ positions, performance }`
- `AA_POLL_MS`: polling interval in ms (default 10000)

### Web3 wallet endpoints
### OpenAPI / Swagger

- Spec: `openapi.yaml`
- UI: `/docs`

### Docker
### SSE

- Live stream: GET `/metrics/stream` (Server-Sent Events), событие `metrics` каждые 5s.

### Admin helpers

- POST `/admin/refresh-metrics` — ручное обновление (если провайдер поддерживает refresh)
- POST `/admin/hooks` — регистрирует webhook { url }
- DELETE `/admin/hooks` — удаляет webhook { url }
- GET `/admin/hooks` — список
- POST `/admin/emit` — отправляет произвольное событие { event, payload }
- GET `/admin/config` — безопасный просмотр конфигурации
- GET `/admin/sessions` — список сессий (мета)
- DELETE `/admin/sessions` — удалить сессию { sessionId }

События:
- rebalance, metrics.update, metrics.refresh
- auth.web3, auth.did
- metrics.tick (включить WEBHOOK_ON_TICK=true)

Безопасность вебхуков:
- Подпись `x-signature: sha256=<hmac>` где `hmac = HMAC_SHA256(WEBHOOK_SECRET, x-id + x-ts + body)`
- Идентификатор `x-id`, метка времени `x-ts` для дедупликации на приёмнике
- Ретраи: WEBHOOK_MAX_RETRIES (по умолчанию 3) с задержкой WEBHOOK_RETRY_DELAY_MS

- Build: `docker build -t pyth-aa .`
- Run: `docker run -p 3000:3000 --env-file .env pyth-aa`
- Compose: `docker-compose up --build`

- GET `/web3/nonce` → { id, nonce }
- POST `/web3/verify` with JSON { id, address, signature, message }
  - message must contain the issued `nonce`

### Sessions and roles

- Upon /web3/verify or /did/verify you receive `{ sessionId, exp }`.
- Send `x-session-id: <sessionId>` header to access protected endpoints.
- Admin role can be granted via `POST /admin/elevate` with `x-admin-token` header and body `{ "sessionId": "..." }`.

### DID (stub)

- POST `/did/verify` with JSON { did, proof } → issues a user session (stub; no real DID validation yet).
```

## 🛠 Environment

See `.env.example` for configuration.

## 📖 License

MIT — REChain Network Solutions

# Autonomous Agent for Pythagorean perpetual futures (pyth)

AA oscript:

```bash
./agent.aa
```

Test file:

```bash
./test/agent.test.oscript.js
```

## Usage

### Run test

```bash
npm run test
# or
yarn test
```

### Lint test files

```bash
npm run lint
# or
yarn lint
```

## Donations

We accept donations through [KatyaAI](https://KatyaAI.org) and forward a portion of the donations to other open-source projects that made Pyth possible.

