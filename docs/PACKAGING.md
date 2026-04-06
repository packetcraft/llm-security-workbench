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

**On Windows (this project):** use `honcho` — it is Python-based and cross-platform. Overmind requires tmux, which is not available on native Windows.

```bash
pip install honcho
```

**On Mac/Linux:** any of the three work:
- **Honcho** (Python): `pip install honcho`
- **Foreman** (Ruby): `gem install foreman`
- **Overmind** (tmux-based, best UX on Mac/Linux): `brew install overmind`

All three read the same `Procfile` format.

### Implementation

The `Procfile` delegates to the existing `npm run` scripts — this is intentional. Those scripts already handle Windows vs Unix venv paths and `.env` loading, so the Procfile stays clean and cross-platform.

**`Procfile` at project root:**

```Procfile
# Ollama must be started separately: ollama serve
# Comment out services you don't need

proxy:      npm start
llmguard:   npm run llmguard
canary:     npm run canary
# airs-sdk:   npm run airs-sdk
# model-scan: npm run model-scan
```

**Usage:**

```bash
# Start everything (core gates)
PYTHONUTF8=1 python -m honcho start

# Start only specific services
PYTHONUTF8=1 python -m honcho start proxy llmguard canary
```

> **Windows encoding note:** Honcho reads `.env` using the system default encoding (cp1252 on Windows), which fails on UTF-8 content. `PYTHONUTF8=1` forces UTF-8 and fixes this. Add it to `~/.bashrc` to avoid typing it each time:
> ```bash
> echo 'export PYTHONUTF8=1' >> ~/.bashrc
> ```
> After that, `python -m honcho start` works without the prefix.

On Mac/Linux with Overmind:
```bash
overmind start              # colour-coded, tmux panes
overmind connect llmguard   # attach to a specific service
overmind restart llmguard   # restart one service without touching others
```

**To skip optional gates**, comment them out in the Procfile — no other changes needed.

### What this does NOT solve

- Portability — still requires local Python venvs and Node installed
- Ollama startup — start `ollama serve` separately before running `honcho start`

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

## Ollama — Why It Lives Outside Docker

### How the pipeline actually works

The security gates are **browser-orchestrated**, not server-enforced. The browser JS calls each gate sequentially via the Node proxy, then calls Ollama directly for inference:

```
Browser JS
  │
  ├─ POST http://localhost:3080/api/llmguard-input   → Node proxy → LLM-Guard :5002
  ├─ POST http://localhost:3080/api/canary           → Node proxy → Canary :5001
  ├─ POST http://localhost:3080/api/prisma           → Node proxy → AIRS cloud
  │
  ├─ POST http://localhost:11434/api/chat            → Ollama DIRECT (no proxy)
  │
  └─ POST http://localhost:3080/api/llmguard-output  → Node proxy → LLM-Guard :5002
```

The Node proxy and Docker containers **never touch Ollama**. Only the browser does.

### Impact on Docker Compose

No impact for single-machine use. When `docker compose up` is running, the browser is still on the host and can reach both:
- `localhost:3080` → mapped to the node-proxy container ✅
- `localhost:11434` → host Ollama ✅

The containers don't route anything to Ollama, so no changes are needed.

### CORS is the only runtime requirement

Ollama blocks cross-origin browser requests by default. `OLLAMA_ORIGINS=*` must be set on the host before launching Ollama (already documented in `docs/SETUP-GUIDE-FULL.md`). Without it, every LLM call silently fails in the browser.

### Remote access / sharing breaks

If someone opens the workbench from another machine on the network (e.g. `http://192.168.1.10:3080`), their browser tries to call `localhost:11434` — which points to **their own machine**, not the host running the workbench.

```
Remote browser
  ├─ http://192.168.1.10:3080/api/...  ✅  reaches Node proxy on the host
  └─ http://localhost:11434/...        ❌  hits their own machine — nothing there
```

The workbench is single-user, single-machine by design. This assumption is baked in at the architecture level.

### The security pipeline is not server-enforceable

Because gates are browser-orchestrated, a user who knows the architecture can call `localhost:11434` directly from DevTools — bypassing every gate. This is acceptable for a testing and demo tool but would not be appropriate for a production security enforcement layer.

### Emergent architecture: centralised security server + distributed Ollama

This is an important and useful side effect of the browser-direct Ollama design. Because the browser on a client machine calls `localhost:11434` — and localhost always resolves to the machine running the browser — the security pipeline and the LLM inference can run on completely separate machines with **no code changes**.

```
Machine A (shared server)             Machine B (each user's laptop)
─────────────────────────────         ──────────────────────────────
docker compose up                     ollama serve
  node-proxy  :3080  ◀────────────── browser opens http://MachineA:3080
  llmguard    :5002        │
  canary      :5001        │          Browser JS calls:
  airs-sdk    :5003        │
                           ├────────▶ http://MachineA:3080/api/...  ✅ security gates
                           └────────▶ http://localhost:11434/...     ✅ local Ollama
```

**What this enables:**

- One Docker Compose security server shared across a team
- Each user runs Ollama locally with whatever model they choose — inference is private to their machine
- Heavy scanning infrastructure (LLM-Guard, 2-3 GB models) is centralised — team members don't each need to run it
- No architectural change required — this works today with the current codebase

**The one requirement on each client machine:**

`OLLAMA_ORIGINS` must include the server's address, since the browser page is served from `MachineA` origin and Ollama on `MachineB` will see it as a cross-origin request:

```bash
# On each client machine (Machine B)
OLLAMA_ORIGINS=http://192.168.1.10:3080   # point to the shared server
# or keep it open:
OLLAMA_ORIGINS=*
```

**Summary of what runs where:**

| Component | Runs on | Why |
| :--- | :--- | :--- |
| Node proxy + Python sidecars | Server (shared) | Heavy, centralised — LLM-Guard alone is 2-3 GB |
| Ollama | Each client machine | Local inference, private to each user |
| Browser | Each client machine | Orchestrates both halves of the pipeline |

This split is a good default target architecture for any team deployment of the workbench.

---

### Future: proxying Ollama through Node

If the workbench ever needs remote access or multi-user sharing, the fix is to proxy Ollama through the Node server. The browser would call `localhost:3080/api/ollama` instead of Ollama directly, and Node forwards it. This would:

- Fix remote sharing (everything routes through one host)
- Make the Docker setup fully self-contained (Ollama can be a compose service)
- Optionally make gate enforcement server-side

This is a meaningful refactor of both `src/server.js` and the browser-side fetch logic — not a quick change. Track as a future phase if multi-user or remote demo use becomes a requirement.

---

## Project Structure — Local Dev and Docker Coexisting

Both setups live in the same repo and share the same source files. They use completely different entry points and never conflict.

```
llm-security-workbench/
│
├── Procfile                        ← LOCAL DEV: overmind/foreman entry point
├── docker-compose.yml              ← DOCKER: full stack, one command
├── Dockerfile.proxy                ← DOCKER: Node proxy image
├── Dockerfile.python               ← DOCKER: shared Python base image
├── .dockerignore                   ← DOCKER: excludes venvs, .env, build artifacts
│
├── src/
│   └── server.js                   ← SHARED — one small change makes it work for both
│
├── services/
│   ├── llm-guard/
│   │   ├── Dockerfile              ← DOCKER: sits next to the Python files
│   │   ├── llmguard_server.py      ← SHARED
│   │   ├── requirements.txt        ← SHARED (used by venv install AND Docker build)
│   │   └── .venv/                  ← LOCAL DEV only (gitignored, dockerignored)
│   │
│   ├── canary/
│   │   ├── Dockerfile
│   │   ├── canary_server.py
│   │   ├── requirements.txt
│   │   └── .venv/
│   │
│   ├── airs-sdk/
│   │   ├── Dockerfile
│   │   ├── airs_sdk_server.py
│   │   ├── requirements.txt
│   │   └── .venv/
│   │
│   └── airs-model-scan/
│       ├── Dockerfile
│       ├── model_scan_server.py
│       ├── requirements.txt
│       └── .venv/
│
├── scripts/                        ← LOCAL DEV only (venv launchers, called by npm run)
│   ├── llmguard.js
│   ├── canary.js
│   └── stage.js
│
├── dev/                            ← SHARED (UI files — Docker serves these too)
├── test/                           ← SHARED
└── .env                            ← SHARED (gitignored — read by both setups)
```

### Why this works without conflict

| Artifact | Local dev | Docker | Note |
| :--- | :--- | :--- | :--- |
| `Procfile` | ✅ used | ignored | overmind/foreman only |
| `docker-compose.yml` | ignored | ✅ used | Compose only |
| `services/**/Dockerfile` | ignored | ✅ used | Docker build only |
| `services/**/.venv/` | ✅ used | excluded | gitignored + dockerignored |
| `scripts/*.js` | ✅ used | ignored | npm run launchers only |
| `src/server.js` | ✅ used | ✅ used | shared — env var fallback handles both |
| `services/**/requirements.txt` | ✅ used | ✅ used | single source of truth for deps |
| `.env` | ✅ used | ✅ used | `dotenv` in Node, `env_file:` in Compose |

### The one seam between both setups

`src/server.js` currently hardcodes `localhost:500X`. Making those env-var-with-fallback means:

- **Local dev** — env var unset → falls back to `localhost:5001` → works as today, no change
- **Docker** — Compose injects `CANARY_URL=http://canary:5001` → service name routing works

This is the single code change that unlocks Docker Compose without breaking anything locally.

### Where to put the Dockerfiles

Each `Dockerfile` lives **inside its service directory** (e.g. `services/llm-guard/Dockerfile`), not in a separate `docker/` folder. This is intentional:

- Docker's build context is always the project root, so `COPY services/llm-guard/requirements.txt ./` works cleanly regardless
- A separate `docker/` tree would require duplicating or symlinking the Python source files — a maintenance burden
- Per-service Dockerfiles are the idiomatic Compose pattern and keep each service self-contained

---

## Implementation Checklist

### Phase 1 — Procfile (do first)

- [x] Create `Procfile` at project root
- [x] Updated PACKAGING.md — corrected tool recommendation (honcho for Windows, Overmind for Mac/Linux)
- [x] Test with `honcho start` — verified working (`PYTHONUTF8=1 python -m honcho start`)
- [x] Windows encoding fix documented — `PYTHONUTF8=1` required due to cp1252/.env conflict
- [ ] Add `honcho` install note to `docs/SETUP-GUIDE-FULL.md`

### Phase 2 — Docker Compose

- [x] Update `src/server.js`: replace hardcoded `localhost:500X` with `process.env.X_URL || 'http://localhost:500X'`
- [x] Create `Dockerfile.proxy`
- [x] Create `Dockerfile.python` (shared Python base — `command:` in compose selects the per-service script)
- [x] Create `docker-compose.yml`
- [x] Create `.dockerignore`
- [ ] Test local-only gates: `docker compose up`
- [ ] Test cloud gates: `docker compose --profile cloud up`
- [ ] Verify LLM-Guard volume persistence across restarts
- [ ] Verify Ollama connectivity (host mode or container)
- [x] Update `docs/SETUP-GUIDE-FULL.md` with Docker Compose quickstart

---

## Summary

| Approach | Effort | Code changes | Portability | Best for |
| :--- | :--- | :--- | :--- | :--- |
| **Procfile + Overmind** | ~10 min | None | Local only | Day-to-day dev |
| **Docker Compose** | 2-4 hrs | 4 lines in `server.js` | Full | Demos, sharing, CI |
