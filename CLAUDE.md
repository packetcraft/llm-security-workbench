# CLAUDE.md — LLM Security Workbench

Project context and working conventions for Claude Code. Read this before making any changes.

---

## What This Project Is

A browser-based LLM security testing workbench. A Node.js proxy (`src/server.js`) serves the UI and routes security scans. All LLM inference runs locally via Ollama. Security scanning uses a six-gate pipeline — some gates local (LLM-Guard, Semantic-Guard, Little-Canary), some cloud (Prisma AIRS).

**Active workbench files:** `dev/5a` and `dev/5b` — these are the ones users run and demo.
- `5b` uses emoji gate names (🔬 🧩 🐦 📥🛡️ 🔀🛡️) — the recommended default
- `5a` uses legacy phase numbers (Phase 0, Phase 0.5, Phase 0.6…) — kept as a reference build

---

## Repository Layout

```
src/
  server.js           # Node proxy :3080 — only backend file; loads .env
  index.html          # Promoted from dev/ via npm run stage

dev/                  # Active iteration files (1a, 1b, 2a, 5a, 5b)
dev/builds/           # Archived intermediate builds (3xx, 4xx) — do not edit

scripts/
  stage.js            # Copies a dev/ file → src/index.html by prefix match
  llmguard.js         # Starts the LLM Guard Python sidecar

llm-guard/
  llmguard_server.py  # Flask sidecar :5002 (Python 3.12)
  requirements.txt
  .venv/              # gitignored — do not commit

python/
  canary_server.py    # Flask microservice :5001 (Little-Canary)

test/
  sample_threats.json # 68-threat adversarial library

docs/                 # Project docs only at the root level
  1-SETUP-GUIDE.md    # Setup for dev/1a, 1b, 2a
  5-SETUP-GUIDE.md    # Setup for dev/5a, 5b (full six-gate)
  ARCHITECTURE.md     # Component diagram, traffic routing, flow diagrams
  SECURITY-GATES.md   # Per-gate deep dives, config tables, system prompts
  TESTING.md          # Verification tests, troubleshooting, usage tips
  PRD.md              # Product requirements v3.1
  notes/              # Personal study notes — not project documentation
```

---

## npm Scripts

| Command | What it does |
| :--- | :--- |
| `npm start` | Start Node proxy on :3080 |
| `npm run stage 5b` | Copy `dev/5b-*.html` → `src/index.html` |
| `npm run stage` | List all available dev files |
| `npm run stage:5b` | Named shortcut (also: 1a, 1b, 2a, 3a–3c, 4a, 4c, 5a) |
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
  →  📥🛡️ AIRS-Inlet  →  🤖 LLM  →  🔀🛡️ AIRS-Dual  →  🔬 LLM-Guard OUTPUT
```

Each gate is independent — Off / Advisory / Strict. All local gates work without an API key.

**Gate name mapping (5a legacy → 5b current):**

| 5a legacy name | 5b name | Emoji |
| :--- | :--- | :--- |
| Phase 0.6 / LLM Guard input | LLM-Guard | 🔬 |
| Phase 0 / Native Guardrail | Semantic-Guard | 🧩 |
| Phase 0.5 / Little Canary | Little-Canary | 🐦 |
| Phase 1 / AIRS Prompt Scan | AIRS-Inlet | 📥🛡️ |
| Phase 2 / AIRS Response Scan | AIRS-Dual | 🔀🛡️ |
| Phase 2.5 / LLM Guard output | LLM-Guard OUTPUT | 🔬 |

Always use 5b names in new documentation and code comments.

---

## Credentials

- `AIRS_API_KEY` and `AIRS_PROFILE` go in `.env` at the project root — never hardcoded
- `.env` is gitignored; `.env.example` is the committed template
- The proxy reads the key server-side; the browser only receives `{ hasApiKey: bool, profile: string | null }` from `/api/config`

---

## Python Requirements

- LLM Guard (`llm-guard/`) requires **Python 3.12** — not 3.13 or 3.14
- Use `py -3.12` explicitly on Windows when creating the venv
- Little-Canary (`python/`) works with Python 3.9+

---

## Docs Conventions

- `docs/` root: project-facing documentation only (setup guides, architecture, PRD, testing)
- `docs/notes/`: personal study notes — not linked from README or other docs
- When writing new documentation, link it from `README.md`'s Documentation table

---

## What Not to Touch

- `dev/builds/` — archived reference files; do not edit or stage these
- `llm-guard/.venv/` — Python virtual environment; gitignored, do not commit
- `llm-guard/llm-guard/` — gitignored pip cache artefact, do not commit
- `.env` — never commit credentials

---

## Commit Style

Short imperative subject line, present tense. No trailing period. Examples:

```
Fix Phase 2.5 batch runner to call runLLMGuardOutput
Add compact badge format to 5b (Safe-312ms style)
Move study notes to docs/notes/
```

Multi-line commits: subject + blank line + bullet points for the detail.
