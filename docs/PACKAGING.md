<!--
  WHAT THIS FILE HOLDS:
  Feasibility study and implementation plan for packaging the LLM Security Workbench
  as a single-command startup — replacing the current four-terminal workflow.

  PHASES:
  Phase 1 (Quick win)   — Procfile + Overmind/Foreman: zero code changes, local dev only
  Phase 2 (Portable)    — Docker Compose: full containerisation, one `docker compose up`

  CROSS-REFERENCES:
  - docs/ARCHITECTURE.md       — component diagram and traffic routing
  - docs/SETUP-GUIDE-FULL.md   — current manual startup instructions
  - src/server.js              — Node proxy (contains localhost:500X references to change)
-->

# Packaging & Deployment

The workbench currently requires four or more terminal sessions to run. This document covers two phases for reducing that to a single command.

---

## Current Multi-Terminal Baseline

| Terminal | Command | Port |
| :--- | :--- | :--- |
| 1 | `ollama serve` | 11434 |
| 2 | `npm start` | 3080 |
| 3 | `npm run llmguard` | 5002 |
| 4 | `npm run canary` | 5001 |
| (optional) | `npm run airs-sdk` | 5003 |
| (optional) | `npm run model-scan` | 5004 |

---

## The Core Constraint: Ollama and the Browser

The browser calls Ollama **directly** at `http://localhost:11434` — this is not proxied through Node. Any packaging approach must keep Ollama reachable from the browser's perspective. This is the key architectural tension.

---

## Phase 1 — Procfile + Overmind (Quick Win)

**Effort:** ~10 minutes. Zero code changes. Solves the multi-terminal problem for local dev.

### How it works

A `Procfile` defines all services. `overmind` (or `foreman`) reads it and launches each process in a managed pane — one command instead of four terminals.

### Prerequisites

Install one of:
- **Overmind** (recommended — better UX, tmux-based): `brew install overmind` / `go install github.com/DarthSim/overmind/v2@latest`
- **Foreman** (simpler, Ruby-based): `gem install foreman`
- **Honcho** (Python alternative): `pip install honcho`

### Implementation

**Create `Procfile` at project root:**

```Procfile
proxy:    npm start
llmguard: python services/llm-guard/.venv/Scripts/python.exe services/llm-guard/llmguard_server.py
canary:   python services/canary/.venv/Scripts/python.exe services/canary/canary_server.py
airs-sdk: python services/airs-sdk/.venv/Scripts/python.exe services/airs-sdk/airs_sdk_server.py
```

> **Windows note:** Replace `Scripts/python.exe` with the actual venv python path. On Unix/Mac it becomes `bin/python`.

**Usage:**

```bash
overmind start          # starts all processes, colour-coded output
overmind connect proxy  # attach to a specific process's terminal
overmind restart llmguard  # restart one service without touching others
```

Or with foreman:

```bash
foreman start           # all processes, interleaved output
```

**To skip optional gates** (e.g. no AIRS credentials), comment them out in the Procfile — no other changes needed.

### What this does NOT solve

- Portability — still requires local Python venvs and Node installed
- Ollama startup — Ollama must still be started separately (it runs as a system service on most setups)

---

## Phase 2 — Docker Compose (Portable)

**Effort:** 2–4 hours. Requires one targeted code change in `src/server.js`. Full portability.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  docker compose up                                          │
│                                                             │
│  ┌─────────────┐   ┌──────────┐   ┌────────────────────┐  │
│  │ node-proxy  │──▶│ canary   │   │ ollama (optional)  │  │
│  │   :3080     │   │  :5001   │   │      :11434        │  │
│  │             │──▶├──────────┤   └────────────────────┘  │
│  │             │   │ llmguard │         ▲                  │
│  │             │   │  :5002   │         │ (browser calls   │
│  │             │──▶├──────────┤         │  directly)       │
│  │             │   │ airs-sdk │                            │
│  │             │   │  :5003   │                            │
│  └─────────────┘   └──────────┘                            │
│         ▲                                                   │
│         │ browser at localhost:3080                         │
└─────────────────────────────────────────────────────────────┘
```

### Required Code Change — `src/server.js`

The proxy currently hardcodes `localhost:500X`. In Docker, services communicate by **container name**, not localhost. Six lines change:

```js
// Before (current)
const CANARY_URL    = 'http://localhost:5001';
const LLMGUARD_URL  = 'http://localhost:5002';
const AIRS_SDK_URL  = 'http://localhost:5003';
const MODEL_SCAN_URL = 'http://localhost:5004';

// After (Docker Compose compatible)
const CANARY_URL    = process.env.CANARY_URL    || 'http://localhost:5001';
const LLMGUARD_URL  = process.env.LLMGUARD_URL  || 'http://localhost:5002';
const AIRS_SDK_URL  = process.env.AIRS_SDK_URL  || 'http://localhost:5003';
const MODEL_SCAN_URL = process.env.MODEL_SCAN_URL || 'http://localhost:5004';
```

With env vars, Docker Compose sets the hostnames; local dev continues to use localhost as fallback. Zero breaking changes.

### Dockerfiles

**Node proxy — `Dockerfile.proxy`:**

```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
COPY dev/ ./dev/
COPY test/ ./test/
EXPOSE 3080
CMD ["node", "src/server.js"]
```

**Python services — `Dockerfile.python` (shared base):**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
ARG SERVICE_DIR
COPY ${SERVICE_DIR}/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY ${SERVICE_DIR}/ ./
EXPOSE 5000
CMD ["python", "server.py"]
```

Each sidecar builds from this with `--build-arg SERVICE_DIR=services/llm-guard` etc.

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  node-proxy:
    build:
      context: .
      dockerfile: Dockerfile.proxy
    ports:
      - "3080:3080"
    env_file: .env
    environment:
      CANARY_URL: http://canary:5001
      LLMGUARD_URL: http://llmguard:5002
      AIRS_SDK_URL: http://airs-sdk:5003
      MODEL_SCAN_URL: http://model-scan:5004
    depends_on:
      canary:
        condition: service_healthy
      llmguard:
        condition: service_healthy
    networks:
      - workbench

  llmguard:
    build:
      context: .
      dockerfile: Dockerfile.python
      args:
        SERVICE_DIR: services/llm-guard
    expose:
      - "5002"
    volumes:
      - hf-cache:/root/.cache/huggingface  # persist 2-3 GB model downloads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5002/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 60s   # LLM-Guard is slow to warm up
    networks:
      - workbench

  canary:
    build:
      context: .
      dockerfile: Dockerfile.python
      args:
        SERVICE_DIR: services/canary
    expose:
      - "5001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - workbench

  airs-sdk:
    build:
      context: .
      dockerfile: Dockerfile.python
      args:
        SERVICE_DIR: services/airs-sdk
    expose:
      - "5003"
    env_file: .env
    profiles:
      - cloud    # opt-in: `docker compose --profile cloud up`
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5003/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - workbench

  model-scan:
    build:
      context: .
      dockerfile: Dockerfile.python
      args:
        SERVICE_DIR: services/airs-model-scan
    expose:
      - "5004"
    env_file: .env
    profiles:
      - model-scan    # opt-in: separate profile, needs private PyPI
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5004/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - workbench

  # Optional: include Ollama in compose (expose port for browser access)
  # ollama:
  #   image: ollama/ollama
  #   ports:
  #     - "11434:11434"
  #   volumes:
  #     - ollama-models:/root/.ollama
  #   networks:
  #     - workbench

volumes:
  hf-cache:          # LLM-Guard HuggingFace model cache (~2-3 GB, persists across restarts)
  # ollama-models:   # Ollama model storage (uncomment if using Ollama container)

networks:
  workbench:
    driver: bridge
```

### `.dockerignore`

```
node_modules/
services/**/.venv/
.env
.git/
dev/builds/
docs/
*.md
```

### Usage

```bash
# Local gates only (no AIRS API key needed)
docker compose up

# Include cloud AIRS gates
docker compose --profile cloud up

# Include model scanning (requires private PyPI setup)
docker compose --profile model-scan up

# Full stack
docker compose --profile cloud --profile model-scan up
```

First run downloads ~2-3 GB of HuggingFace models for LLM-Guard — subsequent starts use the `hf-cache` volume and are fast.

---

## Known Blockers & Mitigations

### LLM-Guard cold start (2-3 GB model download)

- First `docker compose up` takes 10-20 minutes for LLM-Guard to download models
- Subsequent starts: instant (volume persists cache)
- Mitigation: pre-warmup image variant or offline mode (`HF_HUB_OFFLINE=1`) after first run

### Python 3.12 strict requirement (LLM-Guard only)

- Use `python:3.12-slim` as the base for the llmguard service
- Other services can use `python:3.11-slim` or `python:3.12-slim` for consistency

### `model-security-client` private PyPI

- `services/airs-model-scan/` depends on a package not on public PyPI
- The `model-scan` Compose profile is opt-in and requires BuildKit secrets or a pre-built wheel
- Skip this gate if you don't have the private index credentials
- See `docs/GATE-AIRS-MODEL-SECURITY.md` for the three-step bootstrap process

### Ollama browser access

The browser calls Ollama directly at `http://localhost:11434`. Two options:

**Option A — Ollama on host (default):**
Ollama runs natively. Docker services don't need to know about it. Browser hits the host's Ollama as usual. Set `OLLAMA_ORIGINS=*` on the host as you do today.

**Option B — Ollama in compose:**
Uncomment the `ollama` service in `docker-compose.yml`. Expose port `11434`. The browser still hits `localhost:11434` — it just routes to the container. Useful for fully isolated demo environments.

---

## Implementation Checklist

### Phase 1 — Procfile (do first)

- [ ] Create `Procfile` at project root
- [ ] Test with `overmind start` (or `foreman start`)
- [ ] Verify all health indicators go green in the UI
- [ ] Document `overmind` install in `docs/SETUP-GUIDE-FULL.md`

### Phase 2 — Docker Compose

- [ ] Update `src/server.js`: replace hardcoded `localhost:500X` with `process.env.X_URL || 'http://localhost:500X'`
- [ ] Create `Dockerfile.proxy`
- [ ] Create `Dockerfile.python` (shared Python base)
- [ ] Create `docker-compose.yml`
- [ ] Create `.dockerignore`
- [ ] Test local-only gates: `docker compose up`
- [ ] Test cloud gates: `docker compose --profile cloud up`
- [ ] Verify LLM-Guard volume persistence across restarts
- [ ] Verify Ollama connectivity (host mode or container)
- [ ] Update `docs/SETUP-GUIDE-FULL.md` with Docker Compose quickstart

---

## Summary

| Approach | Effort | Code changes | Portability | Best for |
| :--- | :--- | :--- | :--- | :--- |
| **Procfile + Overmind** | ~10 min | None | Local only | Day-to-day dev |
| **Docker Compose** | 2-4 hrs | 4 lines in `server.js` | Full | Demos, sharing, CI |
