# 🛡️ LLM Security Workbench

> **A local-first, browser-based workbench for testing, red-teaming, and auditing LLMs through a live six-gate security pipeline.**

![Workbench in Audit Mode](docs/screenshots/workbench-audit-mode.png)

Run any Ollama model through a layered stack of security gates — transformer scanners, LLM-as-judge, structural injection detection, and optional cloud scanning — and watch every prompt and response get scored, flagged, or blocked in real time.

---

## Why this exists

Most LLM security tools are either cloud-only, require vendor lock-in, or test models in isolation from the security layer. This workbench does something different: it puts you **inside** the pipeline, letting you configure each gate independently and see exactly which gate caught what — and why.

- **Fully local by default** — LLM-Guard, Semantic-Guard, and Little-Canary run entirely on your machine. No API key needed for the core pipeline.
- **Six independent gates** — each configurable as Off / Advisory / Strict. Mix local and cloud scanning however you need.
- **Red Teaming built in** — Static batch runner (76 adversarial threats across 11 categories) + Dynamic Probe (PAIR algorithm with attacker, target, and judge LLMs running locally).
- **API Inspector** — per-gate score, HTTP status, latency, trigger, and config snapshot for every chat turn.
- **Demo / Audit mode** — clean presentation view or full engineering audit view, toggled in one click.

---

## The Pipeline

```
User Prompt
    │
    ▼
🔬 LLM-Guard (input)   — transformer-based scanners (injection, PII, toxicity, secrets …)
    ▼
🧩 Semantic-Guard      — local LLM-as-judge (intent classification)
    ▼
🐦 Little-Canary       — structural injection and pattern detection
    ▼
☁️  AIRS-Inlet          — cloud prompt scan (optional, Palo Alto AIRS)
    ▼
🤖 LLM                 — Ollama model generates response
    ▼
☁️  AIRS-Dual           — cloud response scan (optional)
    ▼
🔬 LLM-Guard (output)  — transformer-based output scanners (PII, URLs, refusal evasion …)
    ▼
User sees response (or a block notification)
```

---

## Quick Start

**Minimum to get a local chat running** (no Python sidecars needed):

```bash
git clone https://github.com/packetcraft/llm-security-workbench.git
cd llm-security-workbench
npm install
```

```bash
# Terminal 1 — Ollama (if not already running)
ollama serve

# Terminal 2 — Node proxy
npm start
```

Open **[http://localhost:3080/dev/8a](http://localhost:3080/dev/8a)**

For the full six-gate pipeline including LLM-Guard and Little-Canary, follow the full setup guide below.

---

## Setup Guides

| Guide | Who it's for |
| :--- | :--- |
| **[Setup Guide — Basic](docs/SETUP-GUIDE-BASIC.md)** | `dev/1a` · `dev/1b` · `dev/2a` — Ollama + Node only, no Python sidecars. Start here if you're new to the workbench. |
| **[Setup Guide — Full Pipeline](docs/SETUP-GUIDE-FULL.md)** | `dev/8a` · `dev/7c` · `dev/6b` — complete six-gate stack with Python sidecars (LLM-Guard, Little-Canary). |

---

## Features & Capabilities

**→ [Workbench Guide](docs/WORKBENCH-GUIDE.md)** — full walk-through of the security pipeline, red teaming, API Inspector, telemetry panel, and modes.

---

## Technical Reference

| Doc | Contents |
| :--- | :--- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Component diagram, traffic routing, Node proxy design |
| **[`docs/SECURITY-GATES.md`](docs/SECURITY-GATES.md)** | **Security gates — pipeline overview, one-paragraph summary per gate** |
| ↳ [`docs/GATE-LLM-GUARD.md`](docs/GATE-LLM-GUARD.md) | LLM-Guard — all 13 scanners, HuggingFace models, thresholds, sidecar API |
| ↳ [`docs/GATE-SEMANTIC-GUARD.md`](docs/GATE-SEMANTIC-GUARD.md) | Semantic-Guard — LLM-as-judge, exact prompts, verdict schema, judge model guide |
| ↳ [`docs/GATE-LITTLE-CANARY.md`](docs/GATE-LITTLE-CANARY.md) | Little-Canary — detection patterns, model recommendations, Flask API |
| ↳ [`docs/GATE-AIRS.md`](docs/GATE-AIRS.md) | AIRS — REST API, SDK sidecar, DLP, enforcement modes |
| ↳ [`docs/GATE-AIRS-MODEL-SECURITY.md`](docs/GATE-AIRS-MODEL-SECURITY.md) | AIRS Model Security — supply-chain scanning of HuggingFace models |
| **Red Teaming** | |
| ↳ [`docs/RED-TEAM-STATIC.md`](docs/RED-TEAM-STATIC.md) | Static Batch Runner — threat library, 6-gate pipeline execution, exports |
| ↳ [`docs/RED-TEAM-DYNAMIC.md`](docs/RED-TEAM-DYNAMIC.md) | Dynamic Probe — PAIR algorithm, attacker/judge prompts, gate trace |
| [`docs/TESTING.md`](docs/TESTING.md) | Gate verification tests and troubleshooting |
| [`docs/PACKAGING.md`](docs/PACKAGING.md) | Packaging — Procfile/Overmind (Phase 1) and Docker Compose (Phase 2) |

---

## Requirements

| | |
| :--- | :--- |
| [Node.js](https://nodejs.org/) 18+ | Proxy server |
| [Ollama](https://ollama.com/) | Local LLM runtime |
| Python 3.12 | LLM-Guard sidecar (strict version requirement) |
| Python 3.9+ | Little-Canary sidecar |
| AIRS API key | Optional — only needed for AIRS-Inlet and AIRS-Dual cloud gates |

---

---

*Built by [@PacketCraft](https://github.com/packetcraft) as a hobby and learning project — to understand inline security for LLMs and LLM-based applications.*
