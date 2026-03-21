# LLM-Guard — Deep Dive Notes

Personal study notes on the `llm-guard` library, how it's integrated into this project, and how to inspect what it's doing at runtime.

---

## What llm-guard Is

[llm-guard](https://github.com/protectai/llm-guard) is an open-source Python library by **ProtectAI**. It provides a collection of transformer-based scanners that run entirely **locally** — no API key, no internet required after the initial model download.

It is not a single model — it's a framework that wraps multiple specialised HuggingFace models, each responsible for detecting one type of threat. You pick which scanners to enable; each runs independently.

---

## Use Cases (in this project)

| Role | Gate name | When it runs |
|:---|:---|:---|
| Input scan | 🔬 LLM-Guard (input) | Before prompt reaches the LLM — catches attacks in the user's message |
| Output scan | 🔬 LLM-Guard OUTPUT | After LLM responds — catches leakage, refusal evasion, malicious content in the reply |

**What it catches:**

- Invisible Unicode / zero-width characters used to smuggle instructions
- Hardcoded secrets and API keys in prompts
- Prompt injection patterns (jailbreaks, role-override attempts)
- Toxic or harmful language
- Banned topics (configurable list)
- PII and sensitive data in responses
- Malicious URLs in responses
- LLM responses that fail to refuse harmful requests (NoRefusal)

---

## Architecture

### How it fits into the workbench

```
Browser (5c UI)
    │
    │  POST /api/llmguard-input  { text, scanners[] }
    ▼
Node.js proxy  (src/server.js :3080)
    │
    │  forwards to localhost:5002/scan/input
    ▼
Flask sidecar  (services/llm-guard/llmguard_server.py :5002)
    │
    ├── runs each requested scanner in sequence
    │   each scanner: loads its HF model (once, then cached in memory)
    │                 calls scanner.scan(text)
    │                 returns { valid, risk_score, sanitized, latency_ms }
    │
    └── returns JSON  { valid: bool, results: { ScannerName: {...}, ... } }
```

The same sidecar handles both directions:
- `POST /scan/input` — scans the user prompt
- `POST /scan/output` — scans the LLM response (takes both `prompt` and `response`)

### Lazy loading

Scanners are **not** loaded at startup. Each scanner's model is downloaded and instantiated on its **first use**, then cached in a Python dict (`_input_cache`, `_output_cache`) for the lifetime of the process. Subsequent calls reuse the warm model — latency drops from 2–5s (cold) to 100–800ms (warm).

### Request/response contract

**Input scan request:**
```json
{
  "text": "the user prompt",
  "scanners": ["PromptInjection", "Toxicity", "Secrets"]
}
```

**Response:**
```json
{
  "valid": true,
  "results": {
    "PromptInjection": { "valid": true,  "risk_score": 0.02, "sanitized": null, "latency_ms": 312 },
    "Toxicity":        { "valid": true,  "risk_score": 0.01, "sanitized": null, "latency_ms": 188 },
    "Secrets":         { "valid": false, "risk_score": 0.99, "sanitized": "[REDACTED]", "latency_ms": 45 }
  }
}
```

If `valid` is `false` on any scanner, the top-level `valid` is also `false`. In Strict mode the workbench blocks the prompt.

---

## Dependencies

**`services/llm-guard/requirements.txt`:**

| Package | Role |
|:---|:---|
| `flask>=3.0.0` | HTTP server — exposes `/scan/input`, `/scan/output`, `/health` |
| `llm-guard>=0.3.14` | ProtectAI scanner library — wraps HuggingFace models |

**llm-guard's own dependencies (installed transitively):**

| Package | Role |
|:---|:---|
| `torch` | PyTorch — runs the transformer models (~1.5 GB) |
| `transformers` | HuggingFace Transformers — model loading, tokenisation, inference |
| `huggingface_hub` | Downloads and caches models from HuggingFace Hub |
| `onnxruntime` | Optional — faster CPU inference (install with `llm-guard[onnxruntime]`) |

> **Python 3.12 required.** llm-guard does not support Python 3.13 or 3.14 as of v0.3.16.

---

## How llm-guard Uses HuggingFace

Each scanner wraps a specific HuggingFace model. When a scanner is first called, `transformers` downloads the model weights from `huggingface.co` into the local cache at:

```
~/.cache/huggingface/hub/
```

Models are downloaded once and reused on every subsequent run.

### Scanner → Model mapping

| Scanner | HuggingFace model | Size (approx) |
|:---|:---|:---|
| PromptInjection | `protectai/deberta-v3-base-prompt-injection-v2` | ~180 MB |
| Toxicity | `nicholasKluge/ToxicityModel` | ~270 MB |
| BanTopics | `facebook/bart-large-mnli` | ~1.6 GB |
| Gibberish | `madhurjindal/autonlp-Gibberish-Detector-492513457` | ~65 MB |
| Language | `papluca/xlm-roberta-base-language-detection` | ~1.1 GB |
| Sensitive (PII) | `dslim/bert-base-NER` (or similar NER model) | ~420 MB |
| MaliciousURLs | URL heuristics + small classifier | small |
| NoRefusal | `protectai/llm-guard-no-refusal-classifier` | ~65 MB |
| Bias | `valurank/distilroberta-bias` | ~80 MB |
| Relevance | `cross-encoder/ms-marco-MiniLM-L-6-v2` | ~85 MB |

Total cold download: **~2–3 GB** (varies by which scanners are enabled).

---

## How to See What HuggingFace Is Doing

### 1. Health endpoint — see which models are loaded in memory

```
GET http://localhost:5002/health
```

Response:
```json
{
  "status": "ok",
  "service": "llm-guard",
  "loaded_input_scanners":  ["PromptInjection", "Toxicity"],
  "loaded_output_scanners": ["NoRefusal"]
}
```

This shows exactly which scanner models are currently warm in the sidecar process. Empty lists mean no prompts have been scanned yet.

### 2. Watch the download happen in real time

The first time you send a prompt through an enabled scanner, HuggingFace model weights download in the terminal running `npm run llmguard`. You'll see progress bars:

```
Downloading (…)config.json: 100%|████████| 481/481 [00:00<00:00, 3.45kB/s]
Downloading model.safetensors:  37%|████    | 183M/495M [00:22<00:38, 8.1MB/s]
```

### 3. List all cached models on disk

```bash
# Windows
dir %USERPROFILE%\.cache\huggingface\hub

# macOS / Linux
ls ~/.cache/huggingface/hub/
```

Each model is stored in a folder named `models--org--model-name`, e.g.:
```
models--protectai--deberta-v3-base-prompt-injection-v2/
models--facebook--bart-large-mnli/
models--nicholasKluge--ToxicityModel/
```

### 4. Check cache size

```bash
# Windows (PowerShell)
(Get-ChildItem "$env:USERPROFILE\.cache\huggingface" -Recurse | Measure-Object -Property Length -Sum).Sum / 1GB

# macOS / Linux
du -sh ~/.cache/huggingface/
```

### 5. Pre-download models before a demo

Activate the venv and use `huggingface-cli`:

```bash
# Windows
services/llm-guard/.venv/Scripts/activate
pip install huggingface_hub

huggingface-cli download protectai/deberta-v3-base-prompt-injection-v2
huggingface-cli download nicholasKluge/ToxicityModel
huggingface-cli download facebook/bart-large-mnli
huggingface-cli download protectai/llm-guard-no-refusal-classifier
huggingface-cli download valurank/distilroberta-bias
huggingface-cli download cross-encoder/ms-marco-MiniLM-L-6-v2
```

### 6. Enable verbose HuggingFace logging

Set this environment variable before starting the sidecar to see every model load and tokeniser call:

```bash
# Windows (PowerShell)
$env:TRANSFORMERS_VERBOSITY = "info"
npm run llmguard

# macOS / Linux
TRANSFORMERS_VERBOSITY=info npm run llmguard
```

### 7. Disable the progress bar (cleaner terminal output)

```bash
$env:HF_HUB_DISABLE_PROGRESS_BARS = "1"   # PowerShell
```

---

## How It Interfaces with the Workbench

```
services/llm-guard/
  llmguard_server.py     Flask app — the only file that runs
  requirements.txt       flask + llm-guard
  .venv/                 Python 3.12 isolated environment (gitignored)

scripts/
  llmguard.js            npm launcher — detects OS, resolves venv Python path,
                         spawns llmguard_server.py as a child process
```

### Startup sequence

1. `npm run llmguard` calls `node scripts/llmguard.js`
2. `llmguard.js` resolves `services/llm-guard/.venv/Scripts/python.exe` (Windows) or `bin/python` (Unix)
3. It spawns `python services/llm-guard/llmguard_server.py` as a child process with `stdio: inherit` — Flask output appears directly in the terminal
4. Flask starts listening on `127.0.0.1:5002`

### Request flow from browser to scanner

```
User submits prompt in 5c UI
    │
    │  fetch("/api/llmguard-input", { text, scanners })
    ▼
src/server.js  :3080
    │  receives POST /api/llmguard-input
    │  forwards to http://localhost:5002/scan/input
    ▼
llmguard_server.py  :5002
    │  runs each scanner (loads HF model on first call)
    │  returns { valid, results }
    ▼
server.js passes response back to browser
    │
    ▼
5c UI shows gate badge:  🔬 Safe-312ms  or  🔬 BLOCKED
```

### Error handling

- If the sidecar is not running, `server.js` returns `502` with the message:
  `"LLM Guard service unavailable — is llmguard_server.py running?"`
- The workbench shows this as a gate error badge and continues (fail-open in Advisory mode, blocks in Strict mode)

---

## Useful Commands Cheatsheet

| Goal | Command |
|:---|:---|
| Start sidecar | `npm run llmguard` |
| Check health + loaded models | `curl http://localhost:5002/health` |
| Test input scan manually | `curl -X POST http://localhost:5002/scan/input -H "Content-Type: application/json" -d "{\"text\":\"hello\",\"scanners\":[\"Toxicity\"]}"` |
| List cached HF models (Windows) | `dir %USERPROFILE%\.cache\huggingface\hub` |
| List cached HF models (macOS) | `ls ~/.cache/huggingface/hub/` |
| Check cache size (macOS) | `du -sh ~/.cache/huggingface/` |
| Verbose model loading | `TRANSFORMERS_VERBOSITY=info npm run llmguard` |
| Recreate venv (Windows) | `Remove-Item -Recurse -Force services/llm-guard/.venv` then `py -3.12 -m venv services/llm-guard/.venv` |
