# Security Gates — Overview

The LLM Security Workbench runs every prompt and response through a six-gate pipeline. Each gate is independent and configurable as **Off**, **Advisory** (flag, continue), or **Strict** (block).

```
User Prompt
    │
    ▼  🔬 LLM-Guard (input)   — local Flask :5002
    ▼  🧩 Semantic-Guard      — local Ollama LLM-as-judge
    ▼  🐦 Little-Canary       — local Flask :5001
    ▼  ☁️  AIRS-Inlet          — cloud (optional)
    ▼  🤖 LLM                 — Ollama
    ▼  ☁️  AIRS-Dual           — cloud (optional)
    ▼  🔬 LLM-Guard (output)  — local Flask :5002
    │
    ▼
User sees response (or a block notification)
```

---

## Gate Summary

### 🔬 LLM-Guard

**Type:** Transformer-based scanner suite — runs locally, no API key required
**Sidecar:** Flask on `:5002` — Python 3.12 required
**Scans:** Prompts (input) and responses (output)

| Direction | Scanners (on by default) | Also available (high FP — off by default) |
| :--- | :--- | :--- |
| Input | InvisibleText, Secrets, PromptInjection, Toxicity, BanTopics | Gibberish, Language |
| Output | Sensitive, MaliciousURLs, NoRefusal | Bias, Relevance, LanguageSame |

Each scanner uses a dedicated HuggingFace transformer model. Models download once on first use (~2–3 GB total). Supports ONNX acceleration for a 30–50% CPU speedup.

→ **[GATE-LLM-GUARD.md](GATE-LLM-GUARD.md)** — all 13 scanners, HuggingFace model paths, thresholds, sidecar API, curl test commands, known limitations

---

### 🧩 Semantic-Guard

**Type:** LLM-as-judge — calls Ollama directly from the browser, no sidecar
**Model:** Any Ollama model; default `JOSIEFIED-Qwen3:4b`
**Scans:** Prompts (input only)

The judge receives the user prompt and a classification system prompt, and returns a structured JSON verdict `{ safe, confidence, reason }`. Uses `temperature: 0.1` and `format: "json"` for stable, low-variance output. Fails open on errors (treats judge timeout or JSON parse failure as safe).

→ **[GATE-SEMANTIC-GUARD.md](GATE-SEMANTIC-GUARD.md)** — exact system prompt, verdict schema, block condition, judge model recommendations, enforcement modes, curl commands

---

### 🐦 Little-Canary

**Type:** Structural + LLM-probe injection detector — runs locally, no API key required
**Sidecar:** Flask on `:5001` — Python 3.9+
**Scans:** Prompts (input only)

Combines regex/pattern matching with a small LLM probe to classify prompts as safe or unsafe. Particularly effective at catching tool-call override patterns and indirect prompt injection via document content. Fast (~200ms typical latency with a small probe model).

→ **[GATE-LITTLE-CANARY.md](GATE-LITTLE-CANARY.md)** — pipeline internals, exact prompts, detection patterns, model recommendations, Flask API, curl commands

---

### ☁️ AIRS-Inlet

**Type:** Cloud prompt scan — Palo Alto Networks AIRS
**Requires:** `AIRS_API_KEY` in `.env`
**Scans:** Prompts (input)

Sends the prompt to the AIRS REST API (`service.api.aisecurity.paloaltonetworks.com`). Returns an action (`allow` / `block`) and a set of `prompt_detected` flags covering seven threat categories. Requests route through the Node proxy at `/api/prisma` to keep the API key server-side.

→ **[GATE-AIRS.md](GATE-AIRS.md)** — REST API, request/response schema, all 7 threat flags, enforcement modes, SDK sidecar, curl commands

---

### ☁️ AIRS-Dual

**Type:** Cloud response scan — Palo Alto Networks AIRS
**Requires:** `AIRS_API_KEY` in `.env`
**Scans:** Prompt + response pair (output)

Sends both the original prompt and the LLM's response to AIRS for a combined scan. Can apply DLP masking to the response before it reaches the user. When AIRS-Dual blocks, LLM-Guard Output is skipped (AIRS-Dual is the terminal gate for that turn).

→ **[GATE-AIRS.md](GATE-AIRS.md)** — same reference doc covers both Inlet and Dual

---

### 🔬 LLM-Guard (output)

**Type:** Transformer-based scanner suite — same sidecar as input gate
**Sidecar:** Flask on `:5002` (shared with input)
**Scans:** Responses (output)

Runs the output scanner set (Sensitive, MaliciousURLs, NoRefusal, and optionally Bias, Relevance, LanguageSame) against the LLM's response. The `Sensitive` scanner detects PII; `NoRefusal` catches responses that should have refused a harmful request but didn't. Shares the same sidecar and the same per-scanner on/off toggles as the input gate.

→ **[GATE-LLM-GUARD.md](GATE-LLM-GUARD.md)** — same reference doc covers both input and output scanners

---

## Mode Reference

| Mode label in UI | Behaviour | Applies to |
| :--- | :--- | :--- |
| **Off** | Gate disabled — skipped entirely | All gates |
| **Advisory** | Flag shown in chat; request continues | LLM-Guard, Little-Canary |
| **Audit** | Flag shown in chat; request continues | Semantic-Guard, AIRS |
| **Strict** | Positive detection blocks the request | LLM-Guard, Semantic-Guard, AIRS |
| **Full** | Positive detection blocks the request | Little-Canary |

Advisory and Audit are functionally identical (flag and continue) — the label difference is a legacy naming artefact from different gate implementations.

---

## Related Docs

| Doc | Contents |
| :--- | :--- |
| [GATE-LLM-GUARD.md](GATE-LLM-GUARD.md) | LLM-Guard deep dive — scanners, models, thresholds, API |
| [GATE-SEMANTIC-GUARD.md](GATE-SEMANTIC-GUARD.md) | Semantic-Guard deep dive — prompts, schema, judge guide |
| [GATE-LITTLE-CANARY.md](GATE-LITTLE-CANARY.md) | Little-Canary deep dive — detection logic, patterns, API |
| [GATE-AIRS.md](GATE-AIRS.md) | AIRS deep dive — REST, SDK, DLP, enforcement |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Component diagram, traffic routing |
| [SETUP-GUIDE-FULL.md](SETUP-GUIDE-FULL.md) | Sidecar installation and startup |
| [TESTING.md](TESTING.md) | Gate verification tests and troubleshooting |
