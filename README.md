# 🛡️ LLM Security Workbench

A local-first AI security testing workbench built on **Ollama** and **Prisma AIRS**. Every prompt and response passes through a configurable six-gate pipeline of local and cloud security scanners.

```
🔬 LLM-Guard (input)  →  🧩 Semantic-Guard  →  🐦 Little-Canary
    →  📥🛡️ AIRS-Inlet  →  🤖 LLM  →  🔀🛡️ AIRS-Dual  →  🔬 LLM-Guard (output)
```

Each gate runs independently in **Off / Advisory / Strict** mode. Local gates (LLM-Guard, Semantic-Guard, Little-Canary) work without any API key.

---

## Prerequisites

| Requirement | Notes |
| :--- | :--- |
| [Node.js](https://nodejs.org/) 18+ | Runs the proxy server |
| [Ollama](https://ollama.com/) | Local LLM runtime |
| Python 3.12 | Required for LLM-Guard sidecar (`dev/5a`, `dev/5b`) |
| Prisma AIRS API key | Optional — required for AIRS-Inlet and AIRS-Dual gates only |

---

## Quick Start

### 1 — Allow Ollama to accept browser requests

**macOS:**
```bash
launchctl setenv OLLAMA_ORIGINS "*"
launchctl setenv OLLAMA_HOST "0.0.0.0"
```
Then relaunch Ollama from the menu bar.

**Windows:**
1. Quit Ollama (system tray → Quit).
2. Open **Edit the system environment variables** → **User variables** → **New...**
   - `OLLAMA_ORIGINS` = `*`
   - `OLLAMA_HOST` = `0.0.0.0`
3. Relaunch Ollama.

### 2 — Install

```bash
git clone https://github.com/packetcraft/llm-security-workbench.git
cd llm-security-workbench
npm install
```

### 3 — (Optional) Store credentials

```bash
cp .env.example .env
# Edit .env and fill in:
#   AIRS_API_KEY=your-x-pan-token-here
#   AIRS_PROFILE=your-profile-name-here
```

The key stays server-side and never reaches the browser. See `docs/5-SETUP-GUIDE.md` for details.

### 4 — Run

```bash
npm start                 # Node proxy on :3080 (required)
npm run canary            # Little-Canary sidecar on :5001 (optional)
npm run llmguard          # LLM Guard sidecar on :5002 (optional, 5a/5b only)
```

Open **`http://localhost:3080/dev/5b`** — or see the dev file table below.

---

## Dev Files

The `dev/` folder contains HTML files representing a progressive build-up from a bare chat to a fully secured workbench. Serve any file directly by prefix:

```
http://localhost:3080/dev/5b    →  five-gate workbench (recommended)
http://localhost:3080/dev/1a    →  bare Ollama chat, no security
```

|   | File | Description | AIRS? |
| :---: | :--- | :--- | :---: |
| ⭐ | `1a` — `ollama-chat-no-security` | Baseline — bare Ollama chat | ✗ |
|   | `1b` — `mechat-no-security` | Personas + model selector, no security | ✗ |
| ⭐ | `2a` — `mechat-airs-teaching-demo` | AIRS prompt gate teaching demo | ✓ |
|   | `3a` — `twin-scan` | AIRS prompt + response scan | ✓ |
|   | `3b` — `native-guardrail` | Adds local LLM-as-judge | ✓ |
|   | `3c` — `little-canary` | Adds Little-Canary injection filter | ✓ |
|   | `4a` — `batch-runner` | Adds Batch Threat Runner | ✓ |
|   | `4b` — `advanced-batch` | Background execution, MD export | ✓ |
|   | `4c` — `threat-import` | garak + JailbreakBench import | ✓ |
| ⭐ | `5a` — `llm-security-workbench-llm-guard` | Six-gate workbench (legacy phase names) | ✓ |
| ⭐ | `5b` — `llm-security-workbench-llm-guard` | Six-gate workbench (emoji gate names) | ✓ |

To make a dev file the default at `http://localhost:3080`:

```bash
npm run stage 5b        # copies dev/5b-*.html → src/index.html
```

3xx and 4xx files are archived in `dev/builds/` and accessible via `/dev/3a`, `/dev/4a` etc.

---

## Documentation

| Doc | Contents |
| :--- | :--- |
| [`docs/5-SETUP-GUIDE.md`](docs/5-SETUP-GUIDE.md) | Full setup for `dev/5a` / `dev/5b` — LLM Guard install, sidecar startup, HuggingFace model downloads |
| [`docs/1-SETUP-GUIDE.md`](docs/1-SETUP-GUIDE.md) | Setup for `dev/1a`, `dev/1b`, `dev/2a` — Ollama, Node install, AIRS key |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Component diagram, traffic routing table, six-gate flow diagram, Node proxy design notes |
| [`docs/SECURITY-GATES.md`](docs/SECURITY-GATES.md) | Per-gate deep dives — how each gate works, configuration tables, recommended models, system prompts |
| [`docs/TESTING.md`](docs/TESTING.md) | Gate-by-gate verification tests, troubleshooting table, usage tips |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements and roadmap |
