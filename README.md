# 🛡️ LLM Security Workbench

This LLM Security Workbench by Packetcraft is a **local-first**, open-source tool designed for security testing and monitoring of Large Language Models (LLMs). 

Every prompt and response passes through a configurable seven-step, six-gate pipeline of local and cloud security scanners.

​It acts as a middleman between a user and an LLM (**typically running locally via Ollama**) to ensure that prompts and responses are safe, secure, and compliant with specific policies.


```
🔬 LLM-Guard (input)  →  🧩 Semantic-Guard  →  🐦 Little-Canary
    →  📥🛡️ AIRS-Inlet  →  🤖 LLM  →  🔀🛡️ AIRS-Dual  →  🔬 LLM-Guard (output)
```

Each gate runs independently in **Off / Advisory / Strict** mode. Local gates (LLM-Guard, Semantic-Guard, Little-Canary) work without any API key.

### ​Key Features and Architecture
​The core of the workbench is a six-gate security pipeline that scans data as it moves from the user to the model and back:

- ​LLM-Guard (Input): Uses the llm-guard library to scan for things like PII (Personally Identifiable Information) or toxic language in the prompt.
- ​Semantic-Guard: A local gate that likely evaluates the intent or meaning of the prompt.
- ​Little-Canary: A specialized filter for catching prompt injection attempts.
- ​AIRS-Inlet: A cloud-based gate using Prisma AIRS (AI Risk Subsystem) for advanced prompt scanning (requires an API key).
- ​LLM Execution: The actual model (e.g., Llama 3, Mistral) processing the request.
- ​AIRS-Dual & LLM-Guard (Output): Final scans of the model's response to ensure it doesn't leak secrets or generate harmful content.

### ​Technical Stack
- ​Runtime: Node.js (Proxy server) and Python 3.12 (for security sidecars).
- ​LLM Backend: Specifically optimized for Ollama (running locally).
- ​Interface: A web-based workbench (HTML/JS) that provides a "Tokyo Night" themed UI with real-time feedback on which security gates passed or failed.
- ​Modes: Each gate can be set to Off, Advisory (warns but allows), or Strict (blocks the request).

### ​Use Cases
- ​Red Teaming: Testing how different LLMs react to jailbreaks or malicious prompts.
- ​Enterprise Evaluation: Assessing which security guardrails are necessary before deploying an LLM-based app.
- ​Privacy Filtering: Ensuring that sensitive data (like API keys or social security numbers) is stripped before being sent to an AI model.

​The repository includes a variety of "dev files" (ranging from 1a to 6a) that allow users to start with a basic chat and progressively add more complex security layers.

---

## Prerequisites

| Requirement | Notes |
| :--- | :--- |
| [Node.js](https://nodejs.org/) 18+ | Runs the proxy server |
| [Ollama](https://ollama.com/) | Local LLM runtime |
| Python 3.12 | Required for LLM-Guard sidecar — macOS: `brew install python@3.12`; Windows: [python.org](https://www.python.org/downloads/) installer (not Microsoft Store) |
| Prisma AIRS API key | Optional — only needed for AIRS-Inlet and AIRS-Dual gates |

---

## Quick Start

### 1 — Install Ollama

**macOS:**
Download the Ollama app from [ollama.com/download](https://ollama.com/download) and move it to `/Applications`. Launch it — it runs as a menu bar app.

Alternatively, install via Homebrew:
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download and run the installer from [ollama.com/download](https://ollama.com/download).

---

### 2 — Set `OLLAMA_ORIGINS`

Required so the browser workbench can reach the Ollama API.

**macOS (permanent — add to `~/.zshrc` or `~/.bash_profile`):**
```bash
echo 'export OLLAMA_ORIGINS="*"' >> ~/.zshrc
source ~/.zshrc
```
Then quit and relaunch Ollama from the menu bar so it picks up the new env var.

> If using `brew install ollama`, set the variable in your shell profile and run `ollama serve` from the terminal instead.

**Windows:**
1. Quit Ollama (system tray → Quit).
2. Open **Edit the system environment variables** → **User variables** → **New…**
   - Variable: `OLLAMA_ORIGINS` — Value: `*`
3. Relaunch Ollama.

---

### 3 — Pull Ollama models

```bash
ollama pull goekdenizguelmez/JOSIEFIED-Qwen3:4b   # main chat + Semantic-Guard
ollama pull qwen2.5:1.5b                           # Little-Canary probe (small/fast)
ollama pull qwen2.5-coder:7b                       # coding-focused chat model
ollama pull llama2-uncensored:latest               # red-team / adversarial testing
```

---

### 4 — Clone and install

```bash
git clone https://github.com/packetcraft/llm-security-workbench.git
cd llm-security-workbench
npm install
```

---

### 5 — Set up Python sidecars

The workbench has three optional Python sidecars. Set up only the ones you need.

#### LLM-Guard sidecar (Python 3.12 required — gates 🔬 input & output)

**macOS / Linux:**
```bash
brew install python@3.12          # macOS only — skip if already installed
python3.12 -m venv services/llm-guard/.venv
source services/llm-guard/.venv/bin/activate
pip install -r services/llm-guard/requirements.txt
```

**Windows:**
```bash
py -3.12 -m venv services/llm-guard/.venv
services\llm-guard\.venv\Scripts\activate
pip install -r services/llm-guard/requirements.txt
```

**First time on a new machine — pre-download all HuggingFace models (~2–3 GB):**
```bash
npm run llmguard:warmup
```
This loads all 13 scanners one by one with progress output. The server stays up after warmup, ready to handle requests immediately.

> **VPN / corporate proxy users:** Models are downloaded from `huggingface.co:443`. If your proxy intercepts TLS, temporarily disable it for the warmup, then enable offline mode in `.env` so the sidecar never contacts HuggingFace again during normal use:
> ```
> HF_HUB_OFFLINE=1
> TRANSFORMERS_OFFLINE=1
> ```
> See `docs/5-SETUP-GUIDE.md` → Step 8 for full details.

#### Little-Canary sidecar (Python 3.9+ — gate 🐦)

Create a dedicated virtual environment and install dependencies:

**macOS / Linux:**
```bash
python3 -m venv services/canary/.venv
source services/canary/.venv/bin/activate
pip install -r services/canary/requirements.txt
```

**Windows:**
```bash
py -3 -m venv services/canary/.venv
services/canary/.venv/Scripts/activate
pip install -r services/canary/requirements.txt
```

Then run `npm run canary` from the same activated terminal, or on Windows run the server directly if `python3` isn't on PATH:
```bash
# Windows (if npm run canary fails)
services/canary/.venv/Scripts/python services/canary/canary_server.py
```

#### AIRS Python SDK sidecar (Python 3.9+ — required for `dev/7a` only)

```bash
pip install flask pan-aisecurity
```

---

### 6 — (Optional) Store AIRS credentials

```bash
cp .env.example .env
# Edit .env and fill in:
#   AIRS_API_KEY=your-x-pan-token-here
#   AIRS_PROFILE=your-profile-name-here
```

The key stays server-side and never reaches the browser. See `docs/5-SETUP-GUIDE.md` for details.

---

### 7 — Run

Open separate terminal tabs for each process:

```bash
npm start                 # Node proxy on :3080 (required)
npm run canary            # Little-Canary sidecar on :5001 (optional)
npm run llmguard          # LLM-Guard sidecar on :5002 (optional)
npm run airs-sdk          # AIRS Python SDK sidecar on :5003 (optional, 7a only)
```

Open **`http://localhost:3080`** — or navigate to a specific dev file:

```
http://localhost:3080/dev/7c    →  full workbench + debug inspector (recommended)
http://localhost:3080/dev/6a    →  full workbench, no debug inspector
http://localhost:3080/dev/1a    →  bare Ollama chat, no security
```

---

## Dev Files

The `dev/` folder contains HTML files representing a progressive build-up from a bare chat to a fully secured workbench. Serve any file directly by prefix:

```
http://localhost:3080/dev/6a    →  six-gate workbench, rail sidebar (recommended)
http://localhost:3080/dev/1a    →  bare Ollama chat, no security
```

|   | File | Description | AIRS? |
| :---: | :--- | :--- | :---: |
|   | `1a` — `ollama-chat-no-security` | Baseline — bare Ollama chat | ✗ |
|   | `1b` — `mechat-no-security` | Personas + model selector, no security | ✗ |
| ⭐ | `2a` — `mechat-airs-teaching-demo` | AIRS prompt gate teaching demo | ✓ |
|   | `3a` — `twin-scan` | AIRS prompt + response scan | ✓ |
|   | `3b` — `native-guardrail` | Adds local LLM-as-judge | ✓ |
|   | `3c` — `little-canary` | Adds Little-Canary injection filter | ✓ |
|   | `4a` — `batch-runner` | Adds Batch Threat Runner | ✓ |
|   | `4b` — `advanced-batch` | Background execution, MD export | ✓ |
|   | `4c` — `threat-import` | garak + JailbreakBench import | ✓ |
|   | `5a` — `llm-security-workbench-llm-guard` | Six-gate workbench (legacy phase names) | ✓ |
|   | `5b` — `llm-security-workbench-llm-guard` | Six-gate workbench (emoji gate names) | ✓ |
|   | `5c` — `llm-security-workbench-llm-guard` | Tokyo Night accordion sidebar, mode badges | ✓ |
|   | `5d` — `rail-sidebar` | Two-layer rail sidebar, 🐙PacketCraft branding (unrefactored) | ✓ |
| ⭐ | `6a` — `instrument-panel` | rail sidebar + live telemetry instrument panel (right panel, open by default) | ✓ |
| ⭐ | `6b` — `dynamic-redteam` | `6a` + 🚩 Red Teaming drawer — Static batch runner + Dynamic Probe (PAIR algorithm) | ✓ |
|   | `7a` — `airs-sdk` | `6b` + 🐍 Prisma AIRS Python SDK — batch pre-scan (5-parallel) via `pan-aisecurity` sidecar | ✓ |
| ⭐ | `7c` — `debug-inspector` | `7a` + 🔍 full-featured API Inspector debug drawer — score, HTTP status, latency, trigger, config snapshot, gate modal popout | ✓ |

To make a dev file the default at `http://localhost:3080`:

```bash
npm run stage 6a        # copies dev/6a-*.html → src/index.html
```

3xx, 4xx, 1xx, 5a, 5b, 5c, and 5d files are archived in `dev/builds/` and accessible via `/dev/3a`, `/dev/5a` etc.

---

## Documentation

| Doc | Contents |
| :--- | :--- |
| [`docs/5-SETUP-GUIDE.md`](docs/5-SETUP-GUIDE.md) | Full setup for `dev/5d` / `dev/6a` — LLM Guard install, sidecar startup, HuggingFace model downloads |
| [`docs/1-SETUP-GUIDE.md`](docs/1-SETUP-GUIDE.md) | Setup for `dev/1a`, `dev/1b`, `dev/2a` — Ollama, Node install, AIRS key |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Component diagram, traffic routing table, six-gate flow diagram, Node proxy design notes |
| [`docs/SECURITY-GATES.md`](docs/SECURITY-GATES.md) | Per-gate deep dives — how each gate works, configuration tables, recommended models, system prompts |
| [`docs/TESTING.md`](docs/TESTING.md) | Gate-by-gate verification tests, troubleshooting table, usage tips |
| [`docs/DYNAMIC-PROBE.md`](docs/DYNAMIC-PROBE.md) | Dynamic Probe (PAIR) architecture — flow diagram, gate coverage, per-gate security trace, judge scoring logic, network routing, result states, limitations |
| [`docs/7A-AIRS-SDK.md`](docs/7A-AIRS-SDK.md) | `dev/7a` technical reference — AIRS Python SDK integration, sidecar design, batch pre-scan cache, sidecar status dots, design decisions, optimisation opportunities |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements and roadmap |
| [`docs/notes/LLM-GUARD-DEEP-DIVE.md`](docs/notes/LLM-GUARD-DEEP-DIVE.md) | LLM-Guard internals — HuggingFace scanner mapping, lazy loading, observability commands |
| [`docs/notes/LITTLE-CANARY-DEEP-DIVE.md`](docs/notes/LITTLE-CANARY-DEEP-DIVE.md) | Little Canary internals — two-stage detection, Ollama probe, comparison with LLM-Guard |
