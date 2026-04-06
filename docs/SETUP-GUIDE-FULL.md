<!--
  SCOPE: This guide covers the full six-gate workbench — dev/6b, dev/7c, dev/8a.
  Requires Node.js, Python 3.12 (LLM-Guard sidecar), and Ollama. AIRS API key is optional.
  For the entry-level files (dev/1a, dev/1b, dev/2a) with no Python sidecars, see docs/SETUP-GUIDE-BASIC.md.
  Files dev/3xx and dev/4xx are intermediate builds not covered by any standalone guide.
  dev/5a–5d, dev/6a, dev/7a, dev/7b are archived in dev/builds/.
-->

# LLM Security Workbench — Full Six-Gate Setup Guide
### `dev/6b` · `dev/7c` · `dev/8a`

This guide walks through a full from-scratch setup of the six-gate LLM security workbench. No prior installation is assumed.

> **Scope:** Full six-gate pipeline — requires Node.js, Python 3.12 (LLM-Guard sidecar), and Ollama. An AIRS API key is optional.
> If you only need the entry-level files (`dev/1a`, `dev/1b`, `dev/2a`) with no Python sidecars, see **[`docs/SETUP-GUIDE-BASIC.md`](SETUP-GUIDE-BASIC.md)** instead.

---

## Dev file comparison

| File | Description |
|:---|:---|
| `dev/8a-ux-improvements.html` | **Current development file.** `7c` + UX improvements (Demo/Audit mode, user bubble, alert→Inspector link) |
| `dev/7c-sdk-api-inspector.html` | `7a` + 🔍 API Inspector debug drawer — per-gate score, HTTP status, latency, trigger, config snapshot |
| `dev/6b-dynamic-redteam.html` | `6a` + 🚩 Red Teaming drawer — Static batch runner + Dynamic Probe (PAIR algorithm) |

Use `8a` for current development and demos. `7c` and `6b` are stable references. Earlier files are archived in `dev/builds/`.

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
☁︎ AIRS-Inlet        — cloud, AIRS prompt scan
    │
    ▼
🤖 LLM Generation      — local Ollama
    │
    ▼
☁︎ AIRS-Dual         — cloud, AIRS response scan
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
🔬 Safe-312ms   🧩 Safe-890ms   🐦 Safe-210ms   ☁︎ Safe-1.2s
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
| honcho | Any | Optional — replaces multi-terminal startup with one command (`pip install honcho`) |

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

AIRS-Inlet and AIRS-Dual (cloud scanning) require a **AIRS API key**. LLM-Guard, Semantic-Guard, and Little-Canary are fully local and work without any API key.

Create a `.env` file in the project root:

```bash
# .env  (never commit this file — it's already in .gitignore)
AIRS_API_KEY=your-x-pan-token-here
AIRS_PROFILE=your-profile-name      # optional
```

An `.env.example` template is included. If no `.env` is present, you can also enter the key directly in the workbench UI under AIRS Settings.

---

## Step 4 — Set Up Python Sidecars

All three local sidecars (LLM-Guard, Little-Canary, AIRS SDK) can be set up with one command:

```bash
npm run setup
```

This creates a separate Python venv for each service and installs its dependencies. Safe to re-run — it skips any venv that already exists.

Expected output:
```
── LLM-Guard  (Python 3.12 required)
   create venv...
   ok     venv created
   install dependencies...
   ok     dependencies installed

── Little-Canary  (Python 3.9+)
   ...

── AIRS SDK sidecar  (Python 3.9+)
   ...

── Summary ─────────────────────────
   ✓ All 3 sidecars ready
```

> **First run for LLM-Guard takes 5–10 minutes** — downloads PyTorch and Transformers (~3 GB total). Subsequent runs are instant.

> **AIRS Model Scan** (`services/airs-model-scan`) is excluded from `npm run setup` — it depends on a private PyPI package. See `docs/GATE-AIRS-MODEL-SECURITY.md` for its separate setup.

### If setup fails for LLM-Guard

LLM-Guard requires **Python 3.12 exactly** (not 3.13 or 3.14). If the venv step fails:

```bash
# Check what Python versions are available
py -0          # Windows
python3 --version  # macOS / Linux
```

If 3.12 is missing, download it from https://www.python.org/downloads/release/python-3129/ then re-run `npm run setup`.

### Optional — faster CPU inference for LLM-Guard (30–50% speedup)

After setup completes, install the ONNX runtime extension:

```bash
# Windows
services/llm-guard/.venv/Scripts/pip install llm-guard[onnxruntime]

# macOS / Linux
services/llm-guard/.venv/bin/pip install llm-guard[onnxruntime]
```

---

## Step 6 — Start Everything

### Option A — Single command with honcho (recommended)

Install honcho once:
```bash
pip install honcho
```

Then start all services from the project root:
```bash
# Terminal 1 — Ollama (still separate — browser calls it directly)
ollama serve

# Terminal 2 — everything else
PYTHONUTF8=1 python -m honcho start
```

> **Windows encoding note:** `PYTHONUTF8=1` is required. Honcho reads `.env` using the Windows default encoding (cp1252), which fails on UTF-8 content. To avoid typing it each time, add `export PYTHONUTF8=1` to `~/.bashrc`.

Honcho reads the `Procfile` at the project root and launches `proxy`, `llmguard`, and `canary` with colour-coded, interleaved output. To include the optional AIRS SDK sidecar, uncomment `airs-sdk` in the `Procfile` first.

---

### Option B — Manual multi-terminal

If you prefer separate terminals (or don't want to install honcho):

#### Terminal 1 — Ollama (if not running as a background service)
```bash
ollama serve
```

#### Terminal 2 — Node.js proxy server
```bash
npm start
```
Expected output:
```
🚀 Workbench running at http://localhost:3080
🛡️ AIRS Proxy active on /api/prisma
```

#### Terminal 3 — LLM Guard sidecar (🔬 LLM-Guard input + output)
```bash
npm run llmguard
```
Expected output:
```
🛡️  LLM Guard sidecar starting on http://localhost:5002
    Input  scanners available: ['InvisibleText', 'Secrets', 'PromptInjection', 'Toxicity', 'BanTopics', 'Gibberish', 'Language']
    Output scanners available: ['Sensitive', 'MaliciousURLs', 'NoRefusal', 'Bias', 'Relevance', 'LanguageSame']
```

#### Terminal 4 — Little Canary sidecar (🐦 Little-Canary)
```bash
npm run canary
```
Expected output:
```
🐦 Little Canary server starting on http://localhost:5001
```

#### Terminal 5 — AIRS SDK sidecar (optional)
```bash
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
| http://localhost:3080/dev/8a | `8a` — `7c` + Demo/Audit mode, user bubble, alert→Inspector link ⭐ current |
| http://localhost:3080/dev/7c | `7c` — full API Inspector debug drawer (stable reference) |
| http://localhost:3080/dev/6b | `6b` — Red Teaming drawer (Static batch + Dynamic Probe) |

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

> **VPN / corporate proxy users:** All models are downloaded from `huggingface.co:443`. If your VPN or proxy intercepts TLS traffic, downloads will fail with an SSL certificate error. Temporarily disable the VPN to run the warmup, then enable offline mode (see below) so `huggingface.co` is never contacted again during normal use.

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

**Run fully offline after warmup (recommended for VPN environments):**

Once all models are cached, enable offline mode in `.env` to prevent LLM-Guard from ever contacting `huggingface.co`:

```bash
# .env
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1
```

`scripts/llmguard.js` reads `.env` and forwards these vars to the Python process automatically — no shell changes needed. With offline mode on, the sidecar loads all models from `~/.cache/huggingface/` and makes no outbound network calls.

---

## Quick Reference — npm Scripts

| Command | What it does |
|:---|:---|
| `npm run setup` | Create all Python venvs and install sidecar dependencies (run once after clone) |
| `PYTHONUTF8=1 python -m honcho start` | Start all services in one terminal (proxy + llmguard + canary) |
| `npm start` | Start the Node.js proxy on :3080 |
| `npm run llmguard` | Start the LLM Guard sidecar on :5002 |
| `npm run canary` | Start the Little-Canary sidecar on :5001 |
| `npm run airs-sdk` | Start the AIRS Python SDK sidecar on :5003 |
| `npm run model-scan` | Start the AIRS Model Security sidecar on :5004 |
| `npm run stage 8a` | Copy `dev/8a-*.html` → `src/index.html` (makes it the default at `/`) |
| `npm run stage 7c` | Copy `dev/7c-*.html` → `src/index.html` |
| `npm run stage 6b` | Copy `dev/6b-*.html` → `src/index.html` |

---

## Security Gates Quick Reference

| Gate (5b name) | 5a legacy name | Port | Mode options | Catches |
|:---|:---|:---|:---|:---|
| 🔬 LLM-Guard (input) | Phase 0.6 | :5002 | Off / Advisory / Strict | Invisible text, secrets, prompt injection, toxicity, banned topics |
| 🧩 Semantic-Guard | Phase 0 | Ollama :11434 | Off / Audit / Strict | Jailbreaks, unsafe intent, social engineering |
| 🐦 Little-Canary | Phase 0.5 | :5001 | Off / Advisory / Full | Prompt injection, structural anomalies |
| ☁︎ AIRS-Inlet | Phase 1 | Cloud | Off / Audit / Strict | Threat categories per AIRS profile |
| ☁︎ AIRS-Dual | Phase 2 | Cloud | Off / Audit / Strict | DLP, malicious content, policy violations |
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

The Batch Threat Runner is available in `6b`, `7c`, and `8a`. It runs all selected threats from the 68-threat adversarial library through the full pipeline automatically.

The bottom summary bar shows catches per gate:
```
🔬 LLM-Guard: 3   🧩 Semantic-Guard: 1   🐦 Little-Canary: 2   ☁︎ AIRS-Inlet: 8   ☁︎ AIRS-Dual: 4   🔬 LG-out: 1
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

**LLM-Guard blocks every prompt with "Flagged by: Toxicity(error)" or similar scanner error**
- A scanner failed to download its model from `huggingface.co:443` — typically caused by a VPN or corporate proxy intercepting TLS
- Fix: temporarily disable the VPN and run `npm run llmguard:warmup` to pre-download all models
- After warmup, enable offline mode in `.env` so the sidecar never contacts HuggingFace again:
  ```
  HF_HUB_OFFLINE=1
  TRANSFORMERS_OFFLINE=1
  ```
- Alternatively, point Python at your organisation's CA bundle: `REQUESTS_CA_BUNDLE=/path/to/corp-ca.crt npm run llmguard` (macOS/Linux) or set `REQUESTS_CA_BUNDLE=C:\path\to\corp-ca.crt` in your environment (Windows)

**LLM Guard install fails (Python version error)**
- `llm-guard>=0.3.14` requires Python 3.9–3.12
- Run `py -0` (Windows) or `python3 --version` to check
- Create the venv explicitly with `py -3.12 -m venv services/llm-guard/.venv`

**LLM-Guard flagging short benign prompts ("hi", "good morning")**
- Language and Gibberish scanners are unreliable on very short inputs — leave them unchecked (default)
- Bias and LanguageSame output scanners can false-positive on short-prompt / long-response pairs — leave them unchecked (default)

**Little-Canary "service unavailable" or `ModuleNotFoundError: No module named 'flask'`**
- The canary sidecar needs its own venv — see Step 5
- macOS/Linux: `services/canary/.venv/bin/pip install -r services/canary/requirements.txt`
- Windows: `services\canary\.venv\Scripts\pip install -r services\canary\requirements.txt`
- `npm run canary` resolves the venv Python automatically — no manual activation needed
- Verify: http://localhost:5001/health should return `{"status":"ok"}`

**AIRS key not being picked up**
- Ensure `.env` is in the project root (same folder as `package.json`)
- Restart `npm start` after editing `.env`
- The UI shows `🔒 .env` next to the key field when loaded correctly

**AIRS SDK sidecar — `ModuleNotFoundError: No module named 'flask'`**
- The sidecar needs its own venv — see Step 5b
- macOS/Linux: `services/airs-sdk/.venv/bin/pip install -r services/airs-sdk/requirements.txt`
- Windows: `services\airs-sdk\.venv\Scripts\pip install -r services\airs-sdk\requirements.txt`

**AIRS SDK sidecar — `SDK available: False`**
- Run the venv pip install above, then restart `npm run airs-sdk`
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
│   ├── 8a-ux-improvements.html                      ← current (Demo/Audit mode, user bubble)
│   ├── 7c-sdk-api-inspector.html                    ← stable reference (API Inspector drawer)
│   ├── 6b-dynamic-redteam.html                      ← stable reference (Red Teaming drawer)
│   └── builds/                                      ← archived iterations (5d, 6a, 7a, 7b, …)
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
│   ├── index.html                                   ← promoted via npm run stage 8a
│   └── server.js                                    ← Node proxy :3080
├── test/
│   └── sample_threats.json                          ← 68-threat adversarial library
├── docs/
│   ├── SETUP-GUIDE-BASIC.md                        ← setup for dev/1a, 1b, 2a
│   └── SETUP-GUIDE-FULL.md                         ← this file
├── Procfile                                         ← honcho/foreman process definitions
├── .env                                             ← your API keys (gitignored)
├── .env.example                                     ← safe template to commit
└── package.json
```
