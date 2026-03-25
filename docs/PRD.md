# 📄 Product Requirements Document: LLM Security Workbench

**Version:** 3.6 (`8a` — Demo/Audit Mode, Ghost Columns, UX Polish)
**Date:** 2026-03-25
**Status:** Active Development

---

## 1. Product Overview

The **LLM Security Workbench** is a local-first, browser-based environment for testing, red-teaming, and auditing LLMs through a live six-gate security pipeline. Built as a hobby and learning project to explore inline security for LLMs and LLM-based applications.

Every chat message passes through up to six independent security gates before and after the LLM:

| # | Gate | Type | Port |
| :--- | :--- | :--- | :--- |
| 1 | 🔬 LLM-Guard (input) | Local — ProtectAI transformer scanners | `:5002` |
| 2 | 🧩 Semantic-Guard | Local — Ollama LLM-as-judge | `:11434` |
| 3 | 🐦 Little-Canary | Local — regex + canary probe | `:5001` |
| 4 | ☁︎ AIRS-Inlet | Cloud — Palo Alto AIRS prompt scan | AIRS API |
| 5 | 🤖 LLM | Local — Ollama inference | `:11434` |
| 6 | ☁︎ AIRS-Dual | Cloud — Palo Alto AIRS response scan | AIRS API |
| 7 | 🔬 LLM-Guard (output) | Local — ProtectAI transformer scanners | `:5002` |

All gates are independently configurable (Off / Advisory / Strict). Cloud gates (AIRS-Inlet, AIRS-Dual) are optional — the local-only gates provide a fully offline security baseline.

---

## 2. Target Audience

| Audience | Use Case |
| :--- | :--- |
| **Security learners** | Understand how inline LLM security layers work in practice |
| **Prompt engineers** | Test system instructions and personas against a categorised threat library |
| **Security teams (Red/Blue)** | Test local models for prompt injection, DLP leakage, and response-side threats |
| **Developers** | Debug LLM payloads with a real-time API Inspector showing all scan phases |

---

## 3. Functional Requirements

### 3.1 Core LLM Interaction

* **Dynamic Model Discovery:** Fetches available models via Ollama `/api/tags`; auto-selects defaults.
* **Real-Time Streaming:** Processes chunked responses via `ReadableStream` on `/api/chat` with rolling buffer to prevent split-JSON parse errors.
* **Abort Generation:** Stop button uses `AbortController` to halt streaming. AIRS-Dual and LLM-Guard OUTPUT are skipped for incomplete responses.
* **Identity Stamping:** Each AI response header shows the model and persona used for that turn.
* **Model Parameter Controls:** Temperature, Top P, Top K, Repeat Penalty — all wired into Ollama `options` on every request.

---

### 3.2 UI/UX Layout

The workbench is a single-page app at `http://localhost:3080/dev/8a`. Three vertical zones:

| Zone | Description |
| :--- | :--- |
| **Left — Security Pipeline** | 225px nav panel. Gate configuration (mode + settings per gate). Always open — no collapse button. |
| **Centre — Chat** | Main prompt/response workspace. Scan badges appear on each message as gates complete. |
| **Right — Live Telemetry** | 220px right panel. Gate latency waterfall, pipeline summary, token counts, model info, memory. |

A 56px icon rail on the far left switches between panes: Security Pipeline, Workspace (model + persona), Red Teaming (🚩), API Inspector (🛠️).

#### Audit Mode vs Demo Mode

| Mode | Description |
| :--- | :--- |
| **Audit Mode** (default) | All panels visible. Gate controls, scan badges, security alerts, telemetry, and API Inspector are all active. Full engineering view. |
| **Demo Mode** | Left and right panels become **ghost columns** — layout is preserved (no reflow, no chat expansion) but all panel content is hidden with `visibility: hidden`. Scan badges and security alert messages are also hidden. Gates still run in the background. Toggle back at any time; all gate settings are preserved. |

Ghost column implementation: CSS `body.demo-mode #nav-panel` and `body.demo-mode #right-panel` force `width` via `!important` override regardless of collapse state, with `visibility: hidden; pointer-events: none` on inner content. This is pure CSS — no JS state management required.

#### Other UX Features

* **Markdown & Syntax Highlighting:** `Marked.js` + `Highlight.js` (GitHub Dark) for code blocks.
* **Auto-expanding prompt input:** `textarea` grows with content; `Shift+Enter` inserts a newline.
* **Compact scan badges:** `SAFE-851MS`, `BLOCKED-2.0S` per-gate format on every message.
* **Scroll-to-bottom:** Floating button appears when chat is scrolled up.
* **Dark/Light theme toggle** in the rail footer.

---

### 3.3 Persona Library

* **Preset personas:** Default, DLP Enforcer, Cyber Security Auditor, Code Architect, and others — each with a pre-written system prompt.
* **Custom personas:** Users write and save their own system prompts; persist via `localStorage`.
* **System prompt editor:** Visible and editable in the Workspace pane.

---

### 3.4 Threat Library

* **76 adversarial prompts** across 11 categories: Basic Threats, Agentic Exploits, Adversarial Framing, Token Manipulation, Output Gate Elicitation, Jailbreak & Persona Override, Indirect Injection, Encoding & Obfuscation, System Prompt Extraction, Social Engineering, Benign/FP tests.
* **Insert Threat dropdown:** Loads any threat directly into the prompt box for one-click testing.
* **Severity levels:** Critical / High / Medium / Low — filterable in the Static Batch Runner.

---

### 3.5 Security Pipeline — Six-Gate Architecture

Every chat message passes through up to six gates in order. A hard-block from any gate short-circuits all subsequent gates.

```
🔬 LLM-Guard (input)  →  🧩 Semantic-Guard  →  🐦 Little-Canary
    →  ☁︎ AIRS-Inlet  →  🤖 LLM  →  ☁︎ AIRS-Dual  →  🔬 LLM-Guard (output)
```

Each gate has three modes:

| Mode | Behaviour |
| :--- | :--- |
| **Off** | Gate skipped entirely |
| **Advisory** | Gate runs; flags shown as warnings but do not block |
| **Strict** | Gate runs; positive detection blocks and short-circuits the pipeline |

---

#### 🔬 LLM-Guard Input (local, optional)

Flask sidecar on `:5002` (`services/llm-guard/llmguard_server.py`). First gate in the pipeline.

**Input scanners (7):** `InvisibleText`, `Secrets`, `PromptInjection`, `Toxicity`, `BanTopics` (enabled by default); `Gibberish`, `Language` (disabled by default — high false-positive rate on short inputs).

Each scanner uses a dedicated HuggingFace model (~2–3 GB total, cached at `~/.cache/huggingface/`).

| Verdict | Strict | Advisory |
| :--- | :--- | :--- |
| Any scanner `valid: false` | 🔬 Block — pipeline short-circuits | 🔬 Flag — continue |
| All pass | ✅ Pass | ✅ Pass |
| Service unavailable | ⚠️ Warn — fail open | ⚠️ Warn — fail open |

→ [Full reference: GATE-LLM-GUARD.md](GATE-LLM-GUARD.md)

---

#### 🔬 LLM-Guard Output (local, optional)

Same `:5002` sidecar, runs **after** AIRS-Dual.

**Output scanners (6):** `Sensitive`, `MaliciousURLs`, `NoRefusal` (enabled by default); `Bias`, `Relevance`, `LanguageSame` (disabled by default — false-positive prone on short-input/long-response pairs).

→ [Full reference: GATE-LLM-GUARD.md](GATE-LLM-GUARD.md)

---

#### 🧩 Semantic-Guard (local, optional)

LLM-as-judge gate. Calls a local Ollama model directly (no sidecar, no proxy) with `format: "json"` and `temperature: 0.1`.

**Verdict schema:** `{ "safe": boolean, "confidence": float 0–1, "reason": string }`

A block triggers when `safe === false` AND `confidence ≥ threshold`.

| Field | Default |
| :--- | :--- |
| Mode | Off |
| Judge model | Auto-selects smallest available Ollama model |
| Confidence threshold | 0.70 |
| System prompt | Editable — pre-filled safety classifier prompt |

**Fail-open:** If the judge model is unavailable, a warning is shown and execution continues to Little-Canary.

→ [Full reference: GATE-SEMANTIC-GUARD.md](GATE-SEMANTIC-GUARD.md)

---

#### 🐦 Little-Canary (local, optional)

Two-layer injection firewall running as a Flask microservice on `:5001`.

**Detection layers:**
1. **Structural filter** — regex/heuristic patterns catch known injection signatures (~1 ms, no LLM).
2. **Canary probe** — a small canary LLM is given a canary question + the user input; if the canary answer is overridden by payload content, injection is detected behaviourally (~250 ms).

**Configuration:**

| Field | Default |
| :--- | :--- |
| Mode | Off |
| Probe model | Auto-selects (prefers `qwen2.5`, `1b`/`3b` variants) |
| Block threshold | 0.6 |

**Advisory mode** injects a `system_prefix` warning into the Ollama system prompt payload — the LLM is made aware of the suspected attack without hard-blocking.

→ [Full reference: GATE-LITTLE-CANARY.md](GATE-LITTLE-CANARY.md)

---

#### ☁︎ AIRS-Inlet — Pre-Flight Prompt Scan

Runs **before** the prompt reaches the LLM. Requires `AIRS_API_KEY` in `.env`.

* Sends `{ prompt }` to AIRS `/v1/scan/sync/request`.
* Strict: block on detection — LLM never called.
* Advisory: warn and continue.
* Fail-open if service unavailable.

→ [Full reference: GATE-AIRS.md](GATE-AIRS.md)

---

#### ☁︎ AIRS-Dual — Post-Response Scan

Runs **after** the LLM has generated its full response.

* Sends `{ prompt, response }` — both sides evaluated.
* Strict: response replaced with block notice.
* Advisory: warning shown; if `response_masked_data` present, displays the AIRS-masked version.
* Skipped if generation was aborted mid-stream.

→ [Full reference: GATE-AIRS.md](GATE-AIRS.md)

---

### 3.6 Live Telemetry Panel

Right panel (220px). Real-time view of every chat turn:

* **Gate Latency waterfall** — one bar per gate, scaled to the slowest. Colour-coded: green (pass), amber (flag), red (block), grey (off).
* **Pipeline summary** — total time, gates run, which gate blocked (if any).
* **Token counts** — prompt tokens, completion tokens, generation speed (t/s).
* **Ollama timing** — model load, prompt eval, generation breakdown.
* **Model info** — name, size, quantisation, context window usage.
* **Memory** — VRAM and RAM usage for the loaded model.

---

### 3.7 API Inspector

Slide-out drawer (🛠️ rail icon). Per-gate breakdown for every chat turn:

| Column | Contents |
| :--- | :--- |
| Gate | Name and emoji |
| Status | PASS / BLOCK / FLAG / OFF |
| HTTP | Response status from the gate service |
| Latency | Time taken for the gate call |
| Score | Risk score (where applicable) |
| Trigger | Which scanner or category fired |

Expand any gate row to see the full config snapshot — system prompts, active scanners, thresholds, and the raw API response. **Expand all** and **Export JSON** available. Security alert badges on chat messages link directly to the relevant Inspector row (scroll + flash highlight).

---

### 3.8 Red Teaming

Opened from the 🚩 rail icon. Two tabs: **Static** and **Dynamic Probe**.

#### 📋 Static Batch Runner

Runs the curated threat library through the full six-gate pipeline, one threat at a time.

* **76 threats, 11 categories**, filterable by severity (Critical / High / Medium / Low) and category.
* Per-threat results: first-catch gate, severity, result (Blocked / Flagged / Allowed), latency.
* Summary bar: block rate per gate, false positives, security gaps.
* **Export:** JSON (machine-readable) and Markdown report.

→ [Full reference: RED-TEAM-STATIC.md](RED-TEAM-STATIC.md)

#### 🔴 Dynamic Probe (PAIR Algorithm)

Generates novel adversarial prompts using three Ollama models — all calling Ollama directly from the browser (no Node proxy involvement).

**Roles:**
| Role | Purpose | Recommended model |
| :--- | :--- | :--- |
| Attacker LLM | Generates adversarial prompts targeting the goal | `dolphin-llama3:8b` (uncensored) |
| Target LLM | Model under test | e.g. `JOSIEFIED-Qwen3:4b` |
| Judge LLM | Scores response 1–10 against the goal | `llama3.1:8b` |

**Iteration loop:**
1. Attacker generates a prompt aimed at the attack goal.
2. Prompt passes through active input gates (LLM-Guard, Semantic-Guard, Little-Canary, AIRS-Inlet).
3. If not blocked, the target LLM responds.
4. Judge scores the response 1–10 with a one-sentence rationale.
5. Score ≥ threshold → 🔴 **BREACHED**; otherwise attacker adapts and tries again (max iterations configurable).

Each attempt card shows: attacker prompt, per-gate trace (status, mode, latency), LLM response, judge score and reasoning. **Export:** JSON or Markdown red team report.

→ [Full reference: RED-TEAM-DYNAMIC.md](RED-TEAM-DYNAMIC.md)

---

### 3.9 Dev File Staging

Any dev file is accessible at `http://localhost:3080/dev/<prefix>` while the server is running. The `/dev/:prefix` route serves the first file in `dev/` whose name starts with the prefix.

```bash
npm run stage 8a      # copies 8a-*.html → src/index.html
npm run stage         # lists all available dev files
```

| Current file | Route |
| :--- | :--- |
| `8a-ux-improvements.html` | `http://localhost:3080/dev/8a` ← current |
| `7c-api-inspector.html` | `http://localhost:3080/dev/7c` ← stable reference |
| `6b-red-teaming.html` | `http://localhost:3080/dev/6b` ← stable reference |

---

## 4. Technical Architecture

### 4.1 Frontend Stack

* **HTML5 / CSS3:** Single-file app. CSS custom properties for theming and layout dimensions. CSS Grid + Flexbox for the three-zone shell.
* **JavaScript:** Vanilla ES6+, `async/await`, Fetch API, `ReadableStream`.
* **Storage:** `localStorage` for personas and AIRS profiles.

### 4.2 Backend Proxy

* **Runtime:** Node.js + Express (port `3080`). Single file: `src/server.js`.
* **Purpose:** CORS bypass for AIRS cloud API; credential management; dev file routing.
* **Credential loading:** `dotenv` loads `.env` at startup. `AIRS_API_KEY` and `AIRS_PROFILE` are read server-side and **never forwarded to the browser**.

| Route | Method | Description |
| :--- | :--- | :--- |
| `/` | GET | Serves `src/index.html` |
| `/dev/:prefix` | GET | Serves the first `/dev` HTML file starting with `:prefix` |
| `/api/config` | GET | Returns `{ hasApiKey: bool, profile: string \| null }` — presence signal only |
| `/api/prisma` | POST | Proxies to AIRS; uses `process.env.AIRS_API_KEY` over any `x-pan-token` header |
| `/api/llmguard-input` | POST | Proxies to `:5002/scan/input` |
| `/api/llmguard-output` | POST | Proxies to `:5002/scan/output` |
| `/api/canary` | POST | Proxies to `:5001/scan`; returns `502` with a message if service is down |

### 4.3 Python Sidecars

| Sidecar | Port | Python version | Start command |
| :--- | :--- | :--- | :--- |
| LLM-Guard (`services/llm-guard/llmguard_server.py`) | `5002` | **3.12 required** | `npm run llmguard` |
| Little-Canary (`services/canary/canary_server.py`) | `5001` | 3.9+ | `npm run canary` |

### 4.4 Security & Privacy

* **Local data sovereignty:** All LLM inference stays on `localhost`. Prompts/responses are only sent to AIRS for security evaluation when that gate is enabled.
* **Local gates are fully offline:** LLM-Guard, Semantic-Guard, and Little-Canary never contact external services.
* **Defense-in-depth:** LLM-based judges (Semantic-Guard, Little-Canary probe) are first-pass filters, not guarantees — they can be adversarially tricked. AIRS provides a second, independent layer.
* **API key handling:** The AIRS key is never returned to the browser. `/api/config` returns only a boolean presence flag.
* **Fail-open design:** If a local gate service is unavailable, a warning is shown and execution continues rather than hard-blocking the user.
* **Incomplete responses:** If the user aborts generation mid-stream, AIRS-Dual and LLM-Guard OUTPUT are skipped — partial responses are never scanned.

---

## 5. Repository Structure

```
llm-security-workbench/
├── src/
│   ├── index.html              # Promoted from dev/ via npm run stage
│   └── server.js               # Node proxy :3080
├── dev/
│   ├── 8a-ux-improvements.html     ← current development file
│   ├── 7c-api-inspector.html       ← stable reference
│   ├── 6b-red-teaming.html         ← stable reference
│   └── builds/                 # Archived earlier iterations (5a–7a)
├── scripts/
│   ├── stage.js                # Copies a dev/ file → src/index.html by prefix match
│   └── llmguard.js             # Starts LLM-Guard Python sidecar via venv
├── services/
│   ├── llm-guard/
│   │   ├── llmguard_server.py  # Flask sidecar :5002 (Python 3.12)
│   │   └── requirements.txt
│   └── canary/
│       ├── canary_server.py    # Flask microservice :5001 (Little-Canary)
│       └── requirements.txt
├── tools/
│   └── garak_to_threats.py     # Converts garak hitlog JSONL → threats JSON
├── test/
│   └── sample_threats.json     # Adversarial threat library
├── docs/
│   ├── README.md → (project root)
│   ├── WORKBENCH-GUIDE.md      # Features & capabilities walk-through
│   ├── ARCHITECTURE.md         # Component diagram, traffic routing
│   ├── SECURITY-GATES.md       # Pipeline overview + gate summaries
│   ├── GATE-LLM-GUARD.md       # LLM-Guard deep dive
│   ├── GATE-SEMANTIC-GUARD.md  # Semantic-Guard deep dive
│   ├── GATE-LITTLE-CANARY.md   # Little-Canary deep dive
│   ├── GATE-AIRS.md            # AIRS deep dive
│   ├── RED-TEAM-STATIC.md      # Static Batch Runner reference
│   ├── RED-TEAM-DYNAMIC.md     # Dynamic Probe / PAIR reference
│   ├── SETUP-GUIDE-BASIC.md    # Setup for dev/1a, 1b, 2a
│   ├── SETUP-GUIDE-FULL.md     # Setup for dev/6b, 7c, 8a
│   ├── TESTING.md              # Gate verification tests and troubleshooting
│   ├── PRD.md                  # This document
│   └── notes/                  # Personal study notes (not linked from README)
├── .env.example                # Template — copy to .env and fill in values
├── .gitignore
└── package.json
```

---

## 6. Build History

### ✅ `dev/8a` — Demo/Audit Mode + UX Polish (v3.6)

* **Demo Mode / Audit Mode toggle:** Top bar button switches between full engineering view and clean presentation view.
* **Ghost columns in Demo Mode:** Nav panel and right panel are preserved as empty space (layout unchanged) with all content hidden via `visibility: hidden`. Chat area does not expand.
* **Left bar permanently open:** The toggle-collapse function for the nav panel was removed entirely — no collapse button, no `toggleNavPanel()`. The rail-brand shield icon is now non-interactive.
* **Right panel Demo Mode lock:** `toggleRightPanel()` no-ops in Demo Mode.

---

### ✅ `dev/7c` — Full-Featured API Inspector (v3.5)

* **API Inspector drawer** redesigned as a slide-out panel from the 🛠️ rail icon.
* Per-gate rows in pipeline order — Status, HTTP code, Latency, Score, Trigger.
* Expand each row to see full config snapshot: system prompts, active scanners, thresholds, raw API response.
* **Alert → Inspector link:** Clicking a security alert badge in chat navigates to and highlights the relevant Inspector row.
* **Export JSON** snapshot of all gate results for the current turn.

---

### ✅ `dev/6b` — Red Teaming Drawer (v3.4)

* **Red Teaming drawer** added (🚩 rail icon): two tabs — Static Batch Runner and Dynamic Probe.
* **Dynamic Probe (PAIR algorithm):** Attacker LLM generates adversarial prompts; Judge LLM scores responses 1–10. All three roles call Ollama directly from the browser. Iterative feedback loop — attacker adapts on gate blocks or low judge scores.
* **Per-attempt gate trace:** colour-coded chip row (status, mode, latency) for each active gate.
* **Export:** JSON and Markdown red team report for both Static and Dynamic runs.

---

### ✅ `dev/6a` — Rail Sidebar + Live Telemetry (v3.3)

* **Two-layer sidebar:** 56px icon rail + 225px nav panel with Security Pipeline and Workspace panes.
* **Live telemetry right panel** open by default: gate latency waterfall, pipeline summary, token counts, Ollama timing, model info, memory.
* **Codebase refactor:** `sendMessage()` split into focused gate phase functions + orchestrator. Shared `updateGateBadge()` helper. `escHtml()` for XSS-safe rendering. DOM element cache.

---

### ✅ `dev/5b` — Gate Rename + LLM-Guard (v3.1)

* **LLM-Guard sidecar** added as gates 1 and 7 — ProtectAI transformer scanners on `:5002`.
* **Gate rename** from legacy phase names (`Phase 0`, `Phase 0.5`, etc.) to current names (Semantic-Guard, Little-Canary, LLM-Guard, AIRS-Inlet, AIRS-Dual).
* **Compact badge format:** `🔬 Safe-312ms`.

---

### ✅ `dev/5d` — Two-Layer Rail Sidebar (v3.2)

* **56px icon rail** + collapsible 272px nav panel replacing accordion sidebar.
* **API Inspector** as slide-up drawer with 7 accordion sections.

---

## 7. Roadmap

### 🟢 Near term

* **Guardrail calibration helper:** Sidebar tool that runs a curated set of safe and adversarial prompts against the current Semantic-Guard judge and system prompt, showing a confusion matrix at each threshold value to enable empirical tuning.
* **Scan history panel:** Persist and review previous scan verdicts within the session.
* **AIRS report deep-link:** Surface `scan_id` / `report_id` from AIRS responses as clickable links to the AIRS console audit trail.
* **Multi-turn conversation history:** Pass a rolling `messages[]` array (last N turns) on every `/api/chat` call so the LLM maintains context across turns.

### 🟡 Medium effort

* **Model comparison mode:** Send the same prompt to two Ollama models simultaneously in a split-pane view, running the full pipeline against both responses.
* **DLP diff view:** When AIRS-Dual returns `response_masked_data`, show a collapsible before/after block — original vs. masked side-by-side — making DLP masking behaviour explicit.
* **Multi-turn AIRS context:** Pass conversation history in the AIRS `contents[]` array for improved multi-turn threat detection.

### 🔴 Advanced

* **Garak integration:** Import Garak hitlog JSONL directly into the Static Batch Runner as additional threat cases (tooling stub exists at `tools/garak_to_threats.py`).
* **Gate benchmarking dashboard:** Run the same threat library with different gate configurations and compare block rates, false positives, and latency across configurations.
