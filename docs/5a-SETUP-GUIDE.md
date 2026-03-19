# LLM Security Workbench v3.0 — Setup Guide
### `dev/5a-llm-security-workbench-llm-guard.html`

This guide walks through a full from-scratch setup of the six-gate LLM security workbench. No prior installation is assumed.

---

## What This Workbench Does

The workbench runs every prompt and response through a layered pipeline of local and cloud security scanners before anything reaches the LLM or the user:

```
User Prompt
    │
    ▼
🛡️ Phase 0.6 — LLM Guard Input      (local Flask, transformer scanners)
    │
    ▼
🔒 Phase 0   — Native Guardrail     (local Ollama LLM-as-judge)
    │
    ▼
🐦 Phase 0.5 — Little Canary        (local Flask, regex + LLM probe)
    │
    ▼
🛡️ Phase 1   — AIRS Prompt Scan     (cloud, Prisma AIRS)
    │
    ▼
🤖 LLM Generation                   (local Ollama)
    │
    ▼
🛡️ Phase 2   — AIRS Response Scan   (cloud, Prisma AIRS)
    │
    ▼
🛡️ Phase 2.5 — LLM Guard Output     (local Flask, transformer scanners)
    │
    ▼
User sees response
```

Each phase has three modes: **Off**, **Advisory** (flag and continue), **Strict** (block). Every phase is independent — you can run any combination.

---

## Prerequisites

| Requirement | Version | Notes |
|:---|:---|:---|
| Node.js | 18+ | Runs the proxy server |
| npm | 9+ | Bundled with Node.js |
| Python | 3.12 | **Must be 3.12** — llm-guard does not support 3.13/3.14 |
| Ollama | Latest | Local LLM runtime |
| Git | Any | To clone the repo |

> **Windows note:** If you have multiple Python versions installed, use `py -3.12` explicitly throughout this guide.

---

## Step 1 — Install Ollama

Ollama runs LLM models locally on your machine.

**macOS / Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download the installer from https://ollama.com/download and run it.

**Verify installation:**
```bash
ollama --version
```

**Pull the recommended models** (one command each — downloads in background):
```bash
# Main chat model (used by the workbench and Phase 0 guardrail)
ollama pull goekdenizguelmez/JOSIEFIED-Qwen3:4b

# Phase 0.5 canary model (small, fast)
ollama pull qwen2.5:1.5b
```

> First pull takes a few minutes depending on your connection. Models are stored in `~/.ollama/models/` and only downloaded once.

**Start Ollama** (if not already running as a service):
```bash
ollama serve
```

Verify it's up: http://localhost:11434 should return `"Ollama is running"`.

---

## Step 2 — Clone and Install the Workbench

```bash
git clone https://github.com/packetcraft/llm-security-workbench.git
cd llm-security-workbench
npm install
```

---

## Step 3 — Configure API Keys (Optional — for AIRS Phase 1 & 2)

Phases 1 and 2 (cloud scanning) require a **Prisma AIRS API key**. Phases 0, 0.5, 0.6, 2.5 are fully local and work without any API key.

Create a `.env` file in the project root:

```bash
# .env  (never commit this file — it's already in .gitignore)
AIRS_API_KEY=your-x-pan-token-here
AIRS_PROFILE=your-profile-name      # optional
```

An `.env.example` template is included. If no `.env` is present, you can also enter the key directly in the workbench UI under AIRS Settings.

---

## Step 4 — Set Up the LLM Guard Sidecar (Phases 0.6 & 2.5)

LLM Guard runs as a Python Flask microservice on port 5002. It requires Python 3.12.

**Create a virtual environment using Python 3.12:**
```bash
# Windows
py -3.12 -m venv llm-guard/.venv

# macOS / Linux
python3.12 -m venv llm-guard/.venv
```

**Activate and install dependencies:**
```bash
# Windows
llm-guard/.venv/Scripts/pip install -r llm-guard/requirements.txt

# macOS / Linux
llm-guard/.venv/bin/pip install -r llm-guard/requirements.txt
```

> **First install takes 5–10 minutes** — it downloads PyTorch and Transformers (~3 GB total).

**Optional — faster CPU inference (30–50% speedup):**
```bash
# Windows
llm-guard/.venv/Scripts/pip install llm-guard[onnxruntime]

# macOS / Linux
llm-guard/.venv/bin/pip install llm-guard[onnxruntime]
```

**Verify the install:**
```bash
# Windows
llm-guard/.venv/Scripts/pip show llm-guard

# macOS / Linux
llm-guard/.venv/bin/pip show llm-guard
```
Expected: `Version: 0.3.16`

---

## Step 5 — Set Up the Little Canary Sidecar (Phase 0.5)

Little Canary runs as a separate Flask microservice on port 5001. It can use the same Python 3.12 venv or a system Python.

```bash
pip install little-canary flask
```

---

## Step 6 — Start Everything

You need **four terminal windows** for the full six-gate pipeline.

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

### Terminal 3 — LLM Guard sidecar (Phases 0.6 & 2.5)
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

### Terminal 4 — Little Canary sidecar (Phase 0.5)
```bash
cd llm-security-workbench
npm run canary
```
Expected output:
```
🐦 Little Canary server starting on http://localhost:5001
```

---

## Step 7 — Open the Workbench

Navigate to: **http://localhost:3080/dev/5a**

On first load, the workbench automatically:
- Fetches available Ollama models and pre-selects `JOSIEFIED-Qwen3:4b`
- Sets all phases to **Strict** mode by default
- Loads the threat library from `test/sample_threats.json`
- Checks `.env` for a pre-loaded AIRS key

---

## Step 8 — First-Run Model Downloads (LLM Guard)

On the first scan through Phase 0.6, LLM Guard downloads HuggingFace models for each scanner. This is a one-time download (~2–3 GB total, cached at `~/.cache/huggingface/`).

**Pre-download to avoid waiting during a demo:**
```bash
# Activate the venv first
llm-guard/.venv/Scripts/activate          # Windows
# source llm-guard/.venv/bin/activate     # macOS / Linux

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
After the first prompt, `loaded_input_scanners` and `loaded_output_scanners` should show all active scanners.

---

## Quick Reference — npm Scripts

| Command | What it does |
|:---|:---|
| `npm start` | Start the Node.js proxy on :3080 |
| `npm run llmguard` | Start the LLM Guard sidecar on :5002 |
| `npm run canary` | Start the Little Canary sidecar on :5001 |
| `npm run stage 5a` | Copy `dev/5a-*.html` → `src/index.html` (makes it the default at `/`) |

---

## Security Phases Quick Reference

| Phase | Name | Port | Mode options | Catches |
|:---|:---|:---|:---|:---|
| 0.6 | LLM Guard Input | :5002 | Off / Advisory / Strict | Invisible text, secrets, injection, toxicity, banned topics, gibberish, non-English |
| 0 | Native Guardrail | Ollama :11434 | Off / Audit / Strict | Jailbreaks, injection, unsafe intent |
| 0.5 | Little Canary | :5001 | Off / Advisory / Full | Prompt injection, structural anomalies |
| 1 | AIRS Prompt Scan | Cloud | Off / Audit / Strict | Threat categories per AIRS profile |
| 2 | AIRS Response Scan | Cloud | Off / Audit / Strict | DLP, malicious content, policy violations |
| 2.5 | LLM Guard Output | :5002 | Off / Advisory / Strict | PII, malicious URLs, refusal evasion, bias, relevance, language mismatch |

---

## Troubleshooting

**Ollama models not appearing in the dropdown**
- Ensure `ollama serve` is running
- Check http://localhost:11434/api/tags returns a model list
- Pull the model: `ollama pull goekdenizguelmez/JOSIEFIED-Qwen3:4b`

**LLM Guard "service unavailable" error**
- Ensure `npm run llmguard` is running in a separate terminal
- Check http://localhost:5002/health returns `{"status":"ok"}`
- If you see `'llm-guard' is not recognized` — run from the **project root**, not the `llm-guard/` subfolder

**LLM Guard install fails (Python version error)**
- `llm-guard>=0.3.14` requires Python 3.9–3.12
- Run `py -0` (Windows) or `python3 --version` to check
- Create the venv explicitly with `py -3.12 -m venv llm-guard/.venv`

**Little Canary "service unavailable" error**
- Ensure `npm run canary` is running
- Check http://localhost:5001/health

**AIRS key not being picked up**
- Ensure `.env` is in the project root (same folder as `package.json`)
- Restart `npm start` after editing `.env`
- The UI shows `🔒 .env` next to the key field when loaded correctly

**Batch Run button not responding**
- Open browser DevTools (F12) → Console tab for JS errors
- Ensure the page loaded without errors

---

## Directory Structure

```
llm-security-workbench/
├── dev/
│   └── 5a-llm-security-workbench-llm-guard.html   ← workbench UI
├── llm-guard/
│   ├── .venv/                                       ← Python 3.12 venv (gitignored)
│   ├── llmguard_server.py                           ← Flask sidecar :5002
│   └── requirements.txt
├── python/
│   └── canary_server.py                             ← Little Canary sidecar :5001
├── src/
│   ├── index.html                                   ← promoted via `npm run stage 5a`
│   └── server.js                                    ← Node proxy :3080
├── test/
│   └── sample_threats.json                          ← 68-threat adversarial library
├── docs/
│   └── 5a-SETUP-GUIDE.md                           ← this file
├── .env                                             ← your API keys (gitignored)
├── .env.example                                     ← safe template to commit
└── package.json
```
