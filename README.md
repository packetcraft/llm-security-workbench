# 🛡️ LLM Security Workbench

This LLM Security Workbench by Packetcraft is a **local-first**, open-source tool designed for security testing and monitoring of Large Language Models (LLMs). 

Every prompt and response passes through a configurable six-gate pipeline of local and cloud security scanners.

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

​The repository includes a variety of "dev files" (ranging from 1a to 5c) that allow users to start with a basic chat and progressively add more complex security layers.

---

## Prerequisites

| Requirement | Notes |
| :--- | :--- |
| [Node.js](https://nodejs.org/) 18+ | Runs the proxy server |
| [Ollama](https://ollama.com/) | Local LLM runtime |
| Python 3.12 | Required for LLM-Guard sidecar (`dev/5b`, `dev/5c`) |
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

### **Environment Setup (Required)**

Before running the security guards, you must initialize the Python virtual environment for the `llm-guard` module. This installs the necessary security libraries.

**On macOS / Linux:**

Bash

```
cd llm-guard
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

**On Windows:**

Bash

```
cd llm-guard
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### **Available Commands**

|**Command**|**Description**|
|---|---|
|`npm run canary`|Starts the Canary token monitoring server to detect prompt injections.|
|`npm run llmguard`|Launches the LLM-Guard server to sanitize inputs and outputs.|
|`npm test`|Runs the security test suite against the configured model.|

**To start the guard server:**

Bash

```
npm run llmguard
```







```bash
npm start                 # Node proxy on :3080 (required)
npm run canary            # Little-Canary sidecar on :5001 (optional)
npm run llmguard          # LLM Guard sidecar on :5002 (optional, 5b/5c only)
```

Open **`http://localhost:3080/dev/5c`** — or see the dev file table below.

---

## Dev Files

The `dev/` folder contains HTML files representing a progressive build-up from a bare chat to a fully secured workbench. Serve any file directly by prefix:

```
http://localhost:3080/dev/5c    →  six-gate workbench, accordion sidebar (recommended)
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
| ⭐ | `5c` — `llm-security-workbench-llm-guard` | Tokyo Night accordion sidebar, mode badges | ✓ |

To make a dev file the default at `http://localhost:3080`:

```bash
npm run stage 5c        # copies dev/5c-*.html → src/index.html
```

3xx, 4xx, 1xx, and 5a files are archived in `dev/builds/` and accessible via `/dev/3a`, `/dev/5a` etc.

---

## Documentation

| Doc | Contents |
| :--- | :--- |
| [`docs/5-SETUP-GUIDE.md`](docs/5-SETUP-GUIDE.md) | Full setup for `dev/5b` / `dev/5c` — LLM Guard install, sidecar startup, HuggingFace model downloads |
| [`docs/1-SETUP-GUIDE.md`](docs/1-SETUP-GUIDE.md) | Setup for `dev/1a`, `dev/1b`, `dev/2a` — Ollama, Node install, AIRS key |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Component diagram, traffic routing table, six-gate flow diagram, Node proxy design notes |
| [`docs/SECURITY-GATES.md`](docs/SECURITY-GATES.md) | Per-gate deep dives — how each gate works, configuration tables, recommended models, system prompts |
| [`docs/TESTING.md`](docs/TESTING.md) | Gate-by-gate verification tests, troubleshooting table, usage tips |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements and roadmap |
