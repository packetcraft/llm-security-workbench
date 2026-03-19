<!--
  SCOPE: This guide covers dev/5b and dev/5c only.
  These are the full six-gate LLM security workbench files including the LLM Guard sidecar.
  For the entry-level files (dev/1a, dev/1b, dev/2a), see docs/1-SETUP-GUIDE.md.
  Files dev/3xx and dev/4xx are intermediate builds not covered by any standalone guide.
  dev/5a (legacy phase names) is archived in dev/builds/.
-->

# LLM Security Workbench — Six-Gate Setup Guide
### `dev/5b` · `dev/5c`

This guide walks through a full from-scratch setup of the six-gate LLM security workbench. No prior installation is assumed.

---

## 5b vs 5c

Both files implement the same six-gate pipeline. The difference is the sidebar UI:

| File | UI |
|:---|:---|
| `dev/5b-llm-security-workbench-llm-guard.html` | Flat panel sidebar with emoji gate names — stable reference build |
| `dev/5c-llm-security-workbench-llm-guard.html` | Tokyo Night accordion sidebar, mode badge pills, persona header pill — recommended default |

Use `5c` for demos and new work. `5b` is retained as a stable reference. `5a` (legacy phase numbers) is archived in `dev/builds/`.

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

### Scan badges in the chat header (5b)

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
| Python | 3.12 | **Must be 3.12** — llm-guard does not support 3.13/3.14 |
| Ollama | Latest | Local LLM runtime |
| Git | Any | To clone the repo |

> **Windows note:** If you have multiple Python versions installed, use `py -3.12` explicitly throughout this guide.

---

## Step 1 — Install Ollama

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
py -3.12 -m venv llm-guard/.venv

# macOS / Linux
python3.12 -m venv llm-guard/.venv
```

**Install dependencies:**
```bash
# Windows
llm-guard/.venv/Scripts/pip install -r llm-guard/requirements.txt

# macOS / Linux
llm-guard/.venv/bin/pip install -r llm-guard/requirements.txt
```

> **First install takes 5–10 minutes** — downloads PyTorch and Transformers (~3 GB total).

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

## Step 5 — Set Up the Little Canary Sidecar (🐦 Little-Canary)

Little-Canary runs as a separate Flask microservice on port 5001. It can use the same Python 3.12 venv or a system Python.

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

---

## Step 7 — Open the Workbench

| URL | File |
|:---|:---|
| http://localhost:3080/dev/5b | `5b` — new names & emojis (recommended) |
| http://localhost:3080/dev/5a | `5a` — legacy phase numbers |

On first load, the workbench automatically:
- Fetches available Ollama models and pre-selects `JOSIEFIED-Qwen3:4b`
- Sets all gates to **Strict** mode by default
- Loads the threat library from `test/sample_threats.json`
- Checks `.env` for a pre-loaded AIRS key

---

## Step 8 — First-Run Model Downloads (LLM Guard)

On the first scan through LLM-Guard, HuggingFace models download for each scanner. This is a one-time download (~2–3 GB total, cached at `~/.cache/huggingface/`).

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
After the first prompt, `loaded_input_scanners` and `loaded_output_scanners` should list all active scanners.

---

## Quick Reference — npm Scripts

| Command | What it does |
|:---|:---|
| `npm start` | Start the Node.js proxy on :3080 |
| `npm run llmguard` | Start the LLM Guard sidecar on :5002 |
| `npm run canary` | Start the Little-Canary sidecar on :5001 |
| `npm run stage 5b` | Copy `dev/5b-*.html` → `src/index.html` (makes it the default at `/`) |
| `npm run stage 5a` | Copy `dev/5a-*.html` → `src/index.html` |

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

The Batch Threat Runner is available inside both `5a` and `5b`. It runs all selected threats from the 68-threat adversarial library through the full pipeline automatically.

The bottom summary bar shows catches per gate:
```
🔬 LLM-Guard: 3   🧩 Semantic-Guard: 1   🐦 Little-Canary: 2   📥🛡️ AIRS-Inlet: 8   🔀🛡️ AIRS-Dual: 4   🔬 LG-out: 1
```

Export options: **JSON** (full result set with per-threat detail) and **Markdown** (summary report with phase catch breakdown).

---

## Troubleshooting

**Ollama models not appearing in the dropdown**
- Ensure `ollama serve` is running
- Check http://localhost:11434/api/tags returns a model list
- Pull the model: `ollama pull goekdenizguelmez/JOSIEFIED-Qwen3:4b`

**LLM Guard "service unavailable" error**
- Ensure `npm run llmguard` is running in a separate terminal
- Check http://localhost:5002/health returns `{"status":"ok"}`
- Run from the **project root**, not the `llm-guard/` subfolder

**LLM Guard install fails (Python version error)**
- `llm-guard>=0.3.14` requires Python 3.9–3.12
- Run `py -0` (Windows) or `python3 --version` to check
- Create the venv explicitly with `py -3.12 -m venv llm-guard/.venv`

**LLM-Guard flagging short benign prompts ("hi", "good morning")**
- Language and Gibberish scanners are unreliable on very short inputs — leave them unchecked (default)
- Bias and LanguageSame output scanners can false-positive on short-prompt / long-response pairs — leave them unchecked (default)

**Little-Canary "service unavailable" error**
- Ensure `npm run canary` is running
- Check http://localhost:5001/health

**AIRS key not being picked up**
- Ensure `.env` is in the project root (same folder as `package.json`)
- Restart `npm start` after editing `.env`
- The UI shows `🔒 .env` next to the key field when loaded correctly

**Batch Run button not responding**
- Open browser DevTools (F12) → Console tab for JS errors

---

## Directory Structure

```
llm-security-workbench/
├── dev/
│   ├── 5a-llm-security-workbench-llm-guard.html   ← workbench UI (legacy names)
│   └── 5b-llm-security-workbench-llm-guard.html   ← workbench UI (new names)
├── llm-guard/
│   ├── .venv/                                       ← Python 3.12 venv (gitignored)
│   ├── llmguard_server.py                           ← Flask sidecar :5002
│   └── requirements.txt
├── python/
│   └── canary_server.py                             ← Little-Canary sidecar :5001
├── src/
│   ├── index.html                                   ← promoted via npm run stage 5b
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
