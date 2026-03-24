<!--
  SCOPE: This guide covers dev/5d, dev/6a, dev/6b, and dev/7a.
  These are the full six-gate LLM security workbench files including the LLM Guard sidecar.
  For the entry-level files (dev/1a, dev/1b, dev/2a), see docs/1-SETUP-GUIDE.md.
  Files dev/3xx and dev/4xx are intermediate builds not covered by any standalone guide.
  dev/5a–5c (earlier iterations) are archived in dev/builds/.
-->

# LLM Security Workbench — Six-Gate Setup Guide
### `dev/5d` · `dev/6a` · `dev/6b` · `dev/7a`

This guide walks through a full from-scratch setup of the six-gate LLM security workbench. No prior installation is assumed.

---

## Dev file comparison

| File | Description |
|:---|:---|
| `dev/7a-airs-sdk.html` | **Current development file.** `6b` + 🐍 AIRS Python SDK evaluation — batch pre-scan (5 parallel) via `pan-aisecurity` sidecar on `:5003` |
| `dev/6b-dynamic-redteam.html` | `6a` + 🚩 Red Teaming drawer — Static batch runner + Dynamic Probe (PAIR algorithm) |
| `dev/6a-instrument-panel.html` | Rail sidebar + live telemetry instrument panel (right panel, open by default) — stable reference |
| `dev/5d-rail-sidebar.html` | Two-layer rail sidebar, 🐙PacketCraft branding — unrefactored; retained as previous iteration reference |

Use `7a` for current development and demos. `6b` and `6a` are stable references. `5a`–`5c` are archived in `dev/builds/`.

---

## What This Workbench Does

Every prompt and response passes through a layered pipeline of local and cloud security scanners before anything reaches the LLM or the user:

```
User Prompt
    │
    ▼
🔬 LLM-Guard (input)   — local Flask :5002, transformer scanners
    │
    ▼
🧩 Semantic-Guard      — local Ollama LLM-as-judge
    │
    ▼
🐦 Little-Canary       — local Flask :5001, regex + LLM probe
    │
    ▼
📥🛡️ AIRS-Inlet        — cloud, Prisma AIRS prompt scan
    │
    ▼
🤖 LLM Generation      — local Ollama
    │
    ▼
🔀🛡️ AIRS-Dual         — cloud, Prisma AIRS response scan
    │
    ▼
🔬 LLM-Guard OUTPUT    — local Flask :5002, transformer scanners
    │
    ▼
User sees response
```

Each gate has three modes: **Off**, **Advisory** (flag and continue), **Strict** (block). Every gate is independent — you can run any combination.

### Scan badges in the chat header

Each active gate appends a compact badge to the user message header as it completes:

```
🔬 Safe-312ms   🧩 Safe-890ms   🐦 Safe-210ms   📥🛡️ Safe-1.2s
```

---

## Prerequisites

| Requirement | Version | Notes |
|:---|:---|:---|
| Node.js | 18+ | Runs the proxy server |
| npm | 9+ | Bundled with Node.js |
| Python | 3.12 | **Must be 3.12** for LLM-Guard — does not support 3.13/3.14 |
| Python | 3.9+ | For Little-Canary and AIRS SDK sidecars (any modern Python works) |
| Ollama | Latest | Local LLM runtime |
| Git | Any | To clone the repo |

> **Windows note:** If you have multiple Python versions installed, use `py -3.12` explicitly for the LLM-Guard venv.

---

## Step 1 — Install Ollama and Configure Origins

**macOS / Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download the installer from https://ollama.com/download and run it.

**Verify:**
```bash
ollama --version
```

**Set `OLLAMA_ORIGINS` to allow browser requests** — required or the workbench will be CORS-blocked:

**macOS:**
```bash
launchctl setenv OLLAMA_ORIGINS "*"
```
Then relaunch Ollama from the menu bar.

**Windows:**
1. Quit Ollama (system tray → Quit).
2. Open **Edit the system environment variables** → **User variables** → **New...**
   - Variable: `OLLAMA_ORIGINS` — Value: `*`
3. Relaunch Ollama.

**Linux:**
```bash
export OLLAMA_ORIGINS="*"
```
Add to `~/.bashrc` or `~/.zshrc` to persist across sessions.

**Pull the recommended models:**
```bash
# Main chat model (also used by Semantic-Guard)
ollama pull goekdenizguelmez/JOSIEFIED-Qwen3:4b

# Little-Canary canary probe model (small, fast)
ollama pull qwen2.5:1.5b
```

**Start Ollama** (if not already running as a service):
```bash
ollama serve
```

Verify: http://localhost:11434 should return `"Ollama is running"`.

---

## Step 2 — Clone and Install the Workbench

```bash
git clone https://github.com/packetcraft/llm-security-workbench.git
cd llm-security-workbench
npm install
```

---

## Step 3 — Configure API Keys (Optional — for AIRS-Inlet & AIRS-Dual)

AIRS-Inlet and AIRS-Dual (cloud scanning) require a **Prisma AIRS API key**. LLM-Guard, Semantic-Guard, and Little-Canary are fully local and work without any API key.

Create a `.env` file in the project root:

```bash
# .env  (never commit this file — it's already in .gitignore)
AIRS_API_KEY=your-x-pan-token-here
AIRS_PROFILE=your-profile-name      # optional
```

An `.env.example` template is included. If no `.env` is present, you can also enter the key directly in the workbench UI under AIRS Settings.

---

## Step 4 — Set Up the LLM Guard Sidecar (🔬 LLM-Guard input & output)

LLM Guard runs as a Python Flask microservice on port 5002. It requires Python 3.12.

**Create a virtual environment:**
```bash
# Windows
py -3.12 -m venv services/llm-guard/.venv

# macOS / Linux
python3.12 -m venv services/llm-guard/.venv
```

**Install dependencies:**
```bash
# Windows
services/llm-guard/.venv/Scripts/pip install -r services/llm-guard/requirements.txt

# macOS / Linux
services/llm-guard/.venv/bin/pip install -r services/llm-guard/requirements.txt
```

> **First install takes 5–10 minutes** — downloads PyTorch and Transformers (~3 GB total).

**Optional — faster CPU inference (30–50% speedup):**
```bash
# Windows
services/llm-guard/.venv/Scripts/pip install llm-guard[onnxruntime]

# macOS / Linux
services/llm-guard/.venv/bin/pip install llm-guard[onnxruntime]
```

**Verify the install:**
```bash
# Windows
services/llm-guard/.venv/Scripts/pip show llm-guard

# macOS / Linux
services/llm-guard/.venv/bin/pip show llm-guard
```
Expected: `Version: 0.3.16`

---

## Step 5 — Set Up the Little Canary Sidecar (🐦 Little-Canary)

Little-Canary runs as a separate Flask microservice on port 5001. It requires a dedicated virtual environment — installing into the system Python or the LLM-Guard venv will cause import errors when `npm run canary` starts.

**macOS / Linux:**
```bash
python3 -m venv services/canary/.venv
source services/canary/.venv/bin/activate
pip install -r services/canary/requirements.txt
```

**Windows:**
```bash
py -3 -m venv services/canary/.venv
services\canary\.venv\Scripts\activate
pip install -r services/canary/requirements.txt
```

> If you have multiple Python versions and want to be explicit, replace `py -3` with `py -3.12` (or whichever version you prefer — 3.9+ works).

**Starting the sidecar:**

Run `npm run canary` from a terminal where the venv is already activated. On Windows, if `python3` is not on PATH, run the server directly instead:

```bash
# Windows — direct invocation (no activation needed)
services\canary\.venv\Scripts\python services\canary\canary_server.py
```

**Verify:** http://localhost:5001/health should return `{"status":"ok","service":"little-canary"}`.

---

## Step 5b — Set Up the AIRS Python SDK Sidecar (🐍 dev/7a only)

The AIRS SDK sidecar exposes a local batch-scan endpoint used by `dev/7a` to pre-scan all batch threats 5-at-a-time via the `pan-aisecurity` Python SDK, before the main batch loop runs. This evaluates the SDK against the existing direct REST path.

It runs on port 5003 and works with Python 3.9+.

```bash
pip install flask pan-aisecurity
```

> A Prisma AIRS API key (`AIRS_API_KEY` in `.env`) is still required — the SDK wraps the same cloud API.

---

## Step 6 — Start Everything

You need **four terminal windows** for the full six-gate pipeline (five if running `dev/7a`).

### Terminal 1 — Ollama (if not running as a background service)
```bash
ollama serve
```

### Terminal 2 — Node.js proxy server
```bash
cd llm-security-workbench
npm start
```
Expected output:
```
🚀 Workbench running at http://localhost:3080
🛡️ Prisma AIRS Proxy active on /api/prisma
```

### Terminal 3 — LLM Guard sidecar (🔬 LLM-Guard input + output)
```bash
cd llm-security-workbench
npm run llmguard
```
Expected output:
```
🛡️  LLM Guard sidecar starting on http://localhost:5002
    Input  scanners available: ['InvisibleText', 'Secrets', 'PromptInjection', 'Toxicity', 'BanTopics', 'Gibberish', 'Language']
    Output scanners available: ['Sensitive', 'MaliciousURLs', 'NoRefusal', 'Bias', 'Relevance', 'LanguageSame']
```

### Terminal 4 — Little Canary sidecar (🐦 Little-Canary)
```bash
cd llm-security-workbench
npm run canary
```
Expected output:
```
🐦 Little Canary server starting on http://localhost:5001
```

### Terminal 5 — AIRS SDK sidecar (🐍 dev/7a only)
```bash
cd llm-security-workbench
npm run airs-sdk
```
Expected output:
```
🐍 AIRS SDK sidecar starting on :5003
   SDK available: True
```

If `SDK available: False` is shown, run `pip install pan-aisecurity` and restart.

---

## Step 7 — Open the Workbench

| URL | File |
|:---|:---|
| http://localhost:3080/dev/7a | `7a` — `6b` + AIRS Python SDK batch pre-scan ⭐ current |
| http://localhost:3080/dev/6b | `6b` — `6a` + Red Teaming drawer (Static batch + Dynamic Probe) |
| http://localhost:3080/dev/6a | `6a` — rail sidebar + live telemetry instrument panel |
| http://localhost:3080/dev/5d | `5d` — same UI as 6a, pre-refactor (previous iteration reference) |
| http://localhost:3080/dev/5c | `5c` — Tokyo Night accordion sidebar (archived) |

On first load, the workbench automatically:
- Fetches available Ollama models and pre-selects `JOSIEFIED-Qwen3:4b`
- Sets all gates to **Strict** mode by default
- Loads the threat library from `test/sample_threats.json`
- Checks `.env` for a pre-loaded AIRS key
- Opens the live telemetry instrument panel (right panel) by default — `6a`/`6b`/`7a`
- Checks all sidecar health endpoints and updates the status dots in the Security Pipeline sidebar — `7a` only

---

## Step 8 — First-Run Model Downloads (LLM Guard)

On the first scan through LLM-Guard, HuggingFace models download for each scanner. This is a one-time download (~2–3 GB total, cached at `~/.cache/huggingface/`).

**Pre-download to avoid waiting during a demo:**
```bash
# Activate the venv first
services/llm-guard/.venv/Scripts/activate          # Windows
# source services/llm-guard/.venv/bin/activate     # macOS / Linux

pip install huggingface_hub

# Input scanner models
huggingface-cli download protectai/deberta-v3-base-prompt-injection-v2
huggingface-cli download nicholasKluge/ToxicityModel
huggingface-cli download facebook/bart-large-mnli         # BanTopics
huggingface-cli download madhurjindal/autonlp-Gibberish-Detector-492513457
huggingface-cli download papluca/xlm-roberta-base-language-detection

# Output scanner models
huggingface-cli download protectai/llm-guard-no-refusal-classifier
huggingface-cli download valurank/distilroberta-bias
huggingface-cli download cross-encoder/ms-marco-MiniLM-L-6-v2
```

**Verify everything is loaded:**
```
http://localhost:5002/health
```
After the first prompt, `loaded_input_scanners` and `loaded_output_scanners` should list all active scanners.

---

## Quick Reference — npm Scripts

| Command | What it does |
|:---|:---|
| `npm start` | Start the Node.js proxy on :3080 |
| `npm run llmguard` | Start the LLM Guard sidecar on :5002 |
| `npm run canary` | Start the Little-Canary sidecar on :5001 |
| `npm run airs-sdk` | Start the AIRS Python SDK sidecar on :5003 (7a only) |
| `npm run stage 7a` | Copy `dev/7a-*.html` → `src/index.html` (makes it the default at `/`) |
| `npm run stage 6b` | Copy `dev/6b-*.html` → `src/index.html` |
| `npm run stage 6a` | Copy `dev/6a-*.html` → `src/index.html` |
| `npm run stage 5d` | Copy `dev/5d-*.html` → `src/index.html` |

---

## Security Gates Quick Reference

| Gate (5b name) | 5a legacy name | Port | Mode options | Catches |
|:---|:---|:---|:---|:---|
| 🔬 LLM-Guard (input) | Phase 0.6 | :5002 | Off / Advisory / Strict | Invisible text, secrets, prompt injection, toxicity, banned topics |
| 🧩 Semantic-Guard | Phase 0 | Ollama :11434 | Off / Audit / Strict | Jailbreaks, unsafe intent, social engineering |
| 🐦 Little-Canary | Phase 0.5 | :5001 | Off / Advisory / Full | Prompt injection, structural anomalies |
| 📥🛡️ AIRS-Inlet | Phase 1 | Cloud | Off / Audit / Strict | Threat categories per AIRS profile |
| 🔀🛡️ AIRS-Dual | Phase 2 | Cloud | Off / Audit / Strict | DLP, malicious content, policy violations |
| 🔬 LLM-Guard OUTPUT | Phase 2.5 | :5002 | Off / Advisory / Strict | PII, malicious URLs, refusal evasion, bias, relevance |

### Default scanner on/off state

**LLM-Guard INPUT — enabled by default:**
InvisibleText, Secrets, PromptInjection, Toxicity, BanTopics

**LLM-Guard INPUT — disabled by default (⚠️ high false-positive rate):**
Gibberish, Language

**LLM-Guard OUTPUT — enabled by default:**
Sensitive, MaliciousURLs, NoRefusal

**LLM-Guard OUTPUT — disabled by default (⚠️ high false-positive rate):**
Bias, Relevance, LanguageSame

---

## Batch Threat Runner

The Batch Threat Runner is available in `5d`, `6a`, `6b`, and `7a`. It runs all selected threats from the 68-threat adversarial library through the full pipeline automatically.

The bottom summary bar shows catches per gate:
```
🔬 LLM-Guard: 3   🧩 Semantic-Guard: 1   🐦 Little-Canary: 2   📥🛡️ AIRS-Inlet: 8   🔀🛡️ AIRS-Dual: 4   🔬 LG-out: 1
```

Export options: **JSON** (full result set with per-threat detail) and **Markdown** (summary report with phase catch breakdown).

### AIRS SDK batch pre-scan (dev/7a only)

When the AIRS SDK sidecar is running (`npm run airs-sdk`), `dev/7a` pre-scans all selected threats through AIRS **before** the main loop begins, using 5 parallel `sync_scan()` calls via the `pan-aisecurity` SDK. Results are cached by prompt text; the batch loop reads from cache instead of making individual REST calls for AIRS-Inlet, eliminating per-threat AIRS latency during the run. If the sidecar is offline, the runner falls back to the existing per-threat REST path silently.

---

## Troubleshooting

**Ollama models not appearing in the dropdown**
- Ensure `ollama serve` is running
- Check http://localhost:11434/api/tags returns a model list
- Pull the model: `ollama pull goekdenizguelmez/JOSIEFIED-Qwen3:4b`

**LLM Guard "service unavailable" error**
- Ensure `npm run llmguard` is running in a separate terminal
- Check http://localhost:5002/health returns `{"status":"ok"}`
- Run from the **project root**, not the `services/llm-guard/` subfolder

**LLM Guard install fails (Python version error)**
- `llm-guard>=0.3.14` requires Python 3.9–3.12
- Run `py -0` (Windows) or `python3 --version` to check
- Create the venv explicitly with `py -3.12 -m venv services/llm-guard/.venv`

**LLM-Guard flagging short benign prompts ("hi", "good morning")**
- Language and Gibberish scanners are unreliable on very short inputs — leave them unchecked (default)
- Bias and LanguageSame output scanners can false-positive on short-prompt / long-response pairs — leave them unchecked (default)

**Little-Canary "service unavailable" or `ModuleNotFoundError: No module named 'flask'`**
- The canary sidecar needs its own venv — see Step 5
- Activate the venv before running `npm run canary`: `source services/canary/.venv/bin/activate` (macOS/Linux) or `services\canary\.venv\Scripts\activate` (Windows)
- On Windows, if `python3` is not recognised, run directly: `services\canary\.venv\Scripts\python services\canary\canary_server.py`
- Verify: http://localhost:5001/health should return `{"status":"ok"}`

**AIRS key not being picked up**
- Ensure `.env` is in the project root (same folder as `package.json`)
- Restart `npm start` after editing `.env`
- The UI shows `🔒 .env` next to the key field when loaded correctly

**AIRS SDK sidecar — `SDK available: False`**
- Run `pip install pan-aisecurity` and restart `npm run airs-sdk`
- Check http://localhost:5003/health — `sdk_error` field shows the Python import error

**AIRS SDK sidecar — dot shows grey / offline after page load**
- Ensure `npm run airs-sdk` is running in a separate terminal
- Hover the grey dot in the Security Pipeline sidebar for the exact error message

**Batch Run button not responding**
- Open browser DevTools (F12) → Console tab for JS errors

---

## Directory Structure

```
llm-security-workbench/
├── dev/
│   ├── 5d-rail-sidebar.html                         ← workbench UI (pre-refactor, previous iteration)
│   ├── 6a-instrument-panel.html                     ← workbench UI (instrument panel)
│   ├── 6b-dynamic-redteam.html                      ← 6a + Red Teaming drawer
│   └── 7a-airs-sdk.html                             ← 6b + AIRS Python SDK evaluation (current)
├── services/
│   ├── llm-guard/
│   │   ├── .venv/                                   ← Python 3.12 venv (gitignored)
│   │   ├── llmguard_server.py                       ← Flask sidecar :5002
│   │   └── requirements.txt
│   ├── canary/
│   │   ├── canary_server.py                         ← Little-Canary sidecar :5001
│   │   └── requirements.txt
│   └── airs-sdk/
│       ├── airs_sdk_server.py                       ← AIRS Python SDK sidecar :5003 (7a only)
│       └── requirements.txt
├── src/
│   ├── index.html                                   ← promoted via npm run stage 7a
│   └── server.js                                    ← Node proxy :3080
├── test/
│   └── sample_threats.json                          ← 68-threat adversarial library
├── docs/
│   ├── 1-SETUP-GUIDE.md                            ← setup for dev/1a, 1b, 2a
│   └── 5-SETUP-GUIDE.md                            ← this file
├── .env                                             ← your API keys (gitignored)
├── .env.example                                     ← safe template to commit
└── package.json
```
