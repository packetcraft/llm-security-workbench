# CLAUDE.md — LLM Security Workbench

Project context and working conventions for Claude Code. Read this before making any changes.

---

## What This Project Is

A browser-based LLM security testing workbench. A Node.js proxy (`src/server.js`) serves the UI and routes security scans. All LLM inference runs locally via Ollama. Security scanning uses a six-gate pipeline — some gates local (LLM-Guard, Semantic-Guard, Little-Canary), some cloud (AIRS).

**Active workbench files:** `dev/6b`, `dev/7c`, and `dev/8a` — these are the ones users run and demo.
- `8a` — `7c` + UX improvements (Demo/Audit mode, ghost columns, alert→Inspector link) — **current development file**
- `7c` — `6b` + full-featured API Inspector drawer (per-gate score, HTTP status, latency, trigger, config snapshot) — stable reference
- `6b` — `6a` + Red Teaming drawer (Static batch runner + Dynamic Probe / PAIR algorithm) — stable reference
- `6a` and earlier — archived in `dev/builds/`

---

## Repository Layout

```
src/
  server.js           # Node proxy :3080 — only backend file; loads .env
  index.html          # Promoted from dev/ via npm run stage

dev/                  # Active iteration files (6b, 7c, 8a)
dev/builds/           # Archived intermediate builds — do not edit

scripts/
  stage.js            # Copies a dev/ file → src/index.html by prefix match
  llmguard.js         # Starts the LLM Guard Python sidecar

services/
  llm-guard/
    llmguard_server.py  # Flask sidecar :5002 (Python 3.12)
    requirements.txt
    .venv/              # gitignored — do not commit
  canary/
    canary_server.py    # Flask microservice :5001 (Little-Canary)
    requirements.txt

tools/
  garak_to_threats.py # Converts garak hitlog JSONL → threats JSON

test/
  sample_threats.json # Adversarial threat library

docs/                 # Project docs only
  WORKBENCH-GUIDE.md    # Features & capabilities walk-through
  SETUP-GUIDE-BASIC.md  # Setup for dev/1a, 1b, 2a
  SETUP-GUIDE-FULL.md   # Setup for dev/6b, 7c, 8a (full six-gate)
  ARCHITECTURE.md       # Component diagram, traffic routing, flow diagrams
  SECURITY-GATES.md     # Pipeline overview + one-paragraph summary per gate
  GATE-LLM-GUARD.md     # LLM-Guard deep dive (13 scanners, models, thresholds)
  GATE-SEMANTIC-GUARD.md # Semantic-Guard deep dive (prompts, verdict schema)
  GATE-LITTLE-CANARY.md  # Little-Canary deep dive (patterns, Flask API)
  GATE-AIRS.md           # AIRS deep dive (REST API, DLP, enforcement modes)
  GATE-AIRS-MODEL-SECURITY.md  # AIRS Model Security — supply-chain scanning of HuggingFace models
  RED-TEAM-STATIC.md     # Static Batch Runner reference
  RED-TEAM-DYNAMIC.md    # Dynamic Probe / PAIR reference
  TESTING.md             # Gate verification tests and troubleshooting
  notes/                 # Personal study notes — not project documentation
```

---

## npm Scripts

| Command | What it does |
| :--- | :--- |
| `npm start` | Start Node proxy on :3080 |
| `npm run stage 8a` | Copy `dev/8a-*.html` → `src/index.html` |
| `npm run stage` | List all available dev files |
| `npm run canary` | Start Little-Canary Flask sidecar on :5001 |
| `npm run llmguard` | Start LLM Guard Flask sidecar on :5002 |

The `stage` script searches `dev/` first, then `dev/builds/` as fallback — prefix matching works for archived files too (e.g. `npm run stage 3c` still works).

---

## Full Pipeline — Four Terminals

To run the complete six-gate pipeline:

```
Terminal 1: ollama serve
Terminal 2: npm start
Terminal 3: npm run llmguard
Terminal 4: npm run canary
```

Ollama requires `OLLAMA_ORIGINS=*` set as an environment variable before launch (macOS: `launchctl setenv`; Windows: system env vars).

---

## Six-Gate Pipeline Order

```
🔬 LLM-Guard (input)  →  🧩 Semantic-Guard  →  🐦 Little-Canary
  →  ☁︎ AIRS-Inlet  →  🤖 LLM  →  ☁︎ AIRS-Dual  →  🔬 LLM-Guard (output)
```

Each gate is independent — Off / Advisory / Strict. All local gates work without an API key.

---

## Credentials

- `AIRS_API_KEY` and `AIRS_PROFILE` go in `.env` at the project root — never hardcoded
- `.env` is gitignored; `.env.example` is the committed template
- The proxy reads the key server-side; the browser only receives `{ hasApiKey: bool, profile: string | null }` from `/api/config`

---

## Python Requirements

- LLM Guard (`services/llm-guard/`) requires **Python 3.12** — not 3.13 or 3.14
- Use `py -3.12` explicitly on Windows when creating the venv
- Little-Canary (`services/canary/`) works with Python 3.9+

---

## Docs Conventions

- `docs/` root: project-facing documentation only
- Gate deep-dive docs use the `GATE-` prefix (e.g. `GATE-LLM-GUARD.md`) so they group visually in the folder
- `docs/notes/`: personal study notes — not linked from README or other docs
- When writing new documentation, link it from `README.md`'s Technical Reference table

---

## What Not to Touch

- `dev/builds/` — archived reference files; do not edit or stage these
- `services/llm-guard/.venv/` — Python virtual environment; gitignored, do not commit
- `.env` — never commit credentials

---

## Commit Style

Short imperative subject line, present tense. No trailing period. Examples:

```
fix demo mode ghost columns in nav panel
add GATE-LLM-GUARD.md deep dive
update TESTING.md with 11 gate verification tests
```

Multi-line commits: subject + blank line + bullet points for the detail.
