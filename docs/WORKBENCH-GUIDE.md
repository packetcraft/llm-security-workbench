# Workbench Guide — Features & Capabilities

This guide walks through what the workbench can do. For setup instructions see the [Setup Guide — Full Pipeline](SETUP-GUIDE-FULL.md). For deep technical detail on each gate see the individual reference docs linked throughout.

---

## The Interface

The workbench is a single-page application served at `http://localhost:3080/dev/8a`. It has three vertical zones:

| Zone | What it is |
| :--- | :--- |
| **Left — Security Pipeline** | Gate configuration panel. Each gate has Off / Advisory / Strict mode and its own settings. |
| **Centre — Chat** | The main prompt/response workspace. Scan badges appear on each message as gates complete. |
| **Right — Live Telemetry** | Gate latency waterfall, pipeline summary, token counts, model memory info. |

The icon rail on the far left switches between the Security Pipeline, Workspace (model + persona settings), and additional tools (Red Teaming, API Inspector).

---

## Audit Mode vs Demo Mode

![Workbench in Audit Mode — all panels visible](screenshots/workbench-audit-mode.png)

**Audit Mode** (default) — all panels visible. Gate controls, scan badges, security alerts, telemetry, and API Inspector are all active. This is the full engineering view.

![Workbench in Demo Mode — clean chat window with ghost columns](screenshots/workbench-demo-mode.png)

**Demo Mode** — one click on the **Audit Mode** button in the top bar toggles to Demo Mode. The left and right panels become empty ghost columns (the layout is preserved — the chat doesn't expand) and scan badges and security alert messages are hidden. This gives a clean, distraction-free view for presenting to an audience. Toggle back at any time — all gate settings are preserved.

---

## Security Pipeline — Six Gates

Every chat message passes through up to six gates before and after the LLM. Gates run in order; a hard-block from any gate short-circuits the rest.

```
🔬 LLM-Guard (input)  →  🧩 Semantic-Guard  →  🐦 Little-Canary
    →  ☁️ AIRS-Inlet  →  🤖 LLM  →  ☁️ AIRS-Dual  →  🔬 LLM-Guard (output)
```

Each gate has three modes:

| Mode | Behaviour |
| :--- | :--- |
| **Off** | Gate is skipped entirely |
| **Advisory** | Gate runs; flags are shown as warnings but do not block the request |
| **Strict** | Gate runs; a positive detection blocks the request and the LLM is never called |

---

### 🔬 LLM-Guard

Transformer-based scanner using the ProtectAI `llm-guard` library. Runs locally as a Flask sidecar on `:5002`.

**Input scanners** (7): InvisibleText, Secrets, PromptInjection, Toxicity, BanTopics, Gibberish, Language

**Output scanners** (6): Sensitive, MaliciousURLs, NoRefusal, Bias, Relevance, LanguageSame

Each scanner uses a dedicated HuggingFace model. Models download once on first use (~2–3 GB, cached). Scanners are individually toggleable in the LLM-Guard settings panel.

→ [Full LLM-Guard Reference](GATE-LLM-GUARD.md)

---

### 🧩 Semantic-Guard

LLM-as-judge gate — calls a local Ollama model directly (no sidecar, no proxy). The judge model receives the user prompt along with a classification system prompt and returns a structured JSON verdict `{ safe, confidence, reason }`.

Default judge model: `JOSIEFIED-Qwen3:4b` (also used as the main chat model). Any Ollama model works. Uses `temperature: 0.1` and `format: "json"` for stable, low-variance verdicts.

→ [Full Semantic-Guard Reference](GATE-SEMANTIC-GUARD.md)

---

### 🐦 Little-Canary

Lightweight injection and structural anomaly detector. Runs as a Flask sidecar on `:5001`. Combines regex pattern matching and a small LLM probe to classify prompts. Particularly effective at catching tool-call override patterns and indirect injection via document content.

→ [Full Little-Canary Reference](GATE-LITTLE-CANARY.md)

---

### ☁️ AIRS-Inlet and AIRS-Dual

Cloud scanning gates using Palo Alto Networks AIRS (AI Runtime Security). Require an API key (`AIRS_API_KEY` in `.env`). AIRS-Inlet scans the prompt; AIRS-Dual scans the prompt + response pair and can apply DLP masking to the response before it reaches the user.

→ [Full AIRS Reference](GATE-AIRS.md) · [pan.dev/airs](https://pan.dev/airs)

---

## Live Telemetry Panel

The right panel shows a real-time view of every chat turn:

- **Gate Latency waterfall** — one bar per gate, scaled to the slowest gate in the turn. Colour-coded: green (pass), amber (advisory flag), red (block), grey (off).
- **Pipeline summary** — total time, gates run, which gate blocked (if any).
- **Token counts** — prompt tokens, completion tokens, total, generation speed (t/s).
- **Ollama timing** — model load, prompt eval, generation breakdown.
- **Model info** — model name, size, quantisation, context window usage.
- **Memory** — VRAM and RAM usage for the loaded model.

---

## API Inspector

![API Inspector — per-gate debug view](screenshots/debug-api-inspection.png)

The API Inspector drawer opens from the 🛠️ icon in the rail. It provides a detailed per-gate breakdown for every chat turn:

| Column | What it shows |
| :--- | :--- |
| Gate | Name and emoji |
| Status | PASS / BLOCK / FLAG / OFF |
| HTTP | Response status from the gate service |
| Latency | Time taken for the gate call |
| Score | Risk score (where applicable) |
| Trigger | Which scanner or category fired |

Click any gate row to expand the full config snapshot — system prompts, active scanners, thresholds, and the raw API response. Use the **Expand all** button to see every gate at once or **Export** to download a JSON snapshot.

When a security alert badge appears on a chat message, clicking it navigates directly to the relevant Inspector entry with a flash highlight.

→ [Architecture Reference](ARCHITECTURE.md)

---

## Red Teaming

The Red Teaming drawer opens from the 🚩 icon in the rail. It has two tabs: **Static** and **Dynamic Probe**.

---

### 📋 Static Batch Runner

![Static Batch Runner — results table](screenshots/redteaming-static.png)

Runs a curated library of known adversarial threats through the full six-gate pipeline one by one, recording which gate caught each threat and why.

**Threat library:** 76 threats across 11 categories — Basic Threats, Agentic Exploits, Adversarial Framing, Token Manipulation, Output Gate Elicitation, Jailbreak & Persona Override, Indirect Injection, Encoding & Obfuscation, System Prompt Extraction, Social Engineering, and Benign/FP tests.

**What it measures:**
- Block rate per gate — which gates are actually catching threats
- Security gaps — threats expected to be caught that weren't
- False positives — benign prompts incorrectly blocked
- Per-threat: first-catch gate, detected category, latency

Filter by severity (Critical / High / Medium / Low) and select/deselect individual threat categories before running. Export full results as JSON or Markdown report.

→ [Full Static Batch Runner Reference](RED-TEAM-STATIC.md)

---

### 🔴 Dynamic Probe (PAIR Algorithm)

![Dynamic Probe — iteration log with gate trace](screenshots/redteaming-dynamic-probe.png)

Generates novel adversarial prompts using an **attacker LLM**, runs them through your active input gates, passes unblocked prompts to the **target LLM**, then scores the response using a **judge LLM** — all running locally via Ollama.

Based on **PAIR** — Prompt Automatic Iterative Refinement (Chao et al., 2023).

**How it works:**
1. You provide an attack goal (e.g. *"Get the model to explain how to pick a lock in detail"*)
2. The attacker LLM generates an adversarial prompt aimed at that goal
3. The prompt runs through your active input gates (LLM-Guard, Little-Canary, AIRS-Inlet)
4. If not blocked, the target LLM responds
5. The judge LLM scores the response 1–10 against the goal
6. If score ≥ threshold → 🔴 **BREACHED**; otherwise the attacker adapts and tries again

The attacker receives feedback each iteration: if blocked, it rewrites to evade the gate; if it reached the LLM but scored low, it escalates with new framing (story, professional context, hypotheticals).

**Model recommendations:**
- Attacker: `dolphin-llama3:8b` — uncensored, generates adversarial content without self-censoring
- Judge: `llama3.1:8b` — strong reasoning; follows the 1–10 scoring rubric reliably
- Target: the model under test (e.g. `JOSIEFIED-Qwen3:4b`)

Each attempt card shows the attack prompt, gate trace (with per-gate status, mode, latency), LLM response, and judge reasoning. Export full probe session as JSON or Markdown report.

→ [Full Dynamic Probe Reference](RED-TEAM-DYNAMIC.md)

---

## Workspace & Personas

The Workspace pane (⬡ in the rail) gives access to:

- **Model selector** — choose any Ollama model from the auto-populated dropdown
- **Persona selector** — preset system prompts (Default, DLP Enforcer, Cyber Security Auditor, etc.) or write your own
- **System prompt editor** — full system prompt visible and editable

The active model is shown in the top bar alongside the current gate version badge (e.g. `v3.1 + LLM-Guard`).

---

## Insert Threat

The **INSERT THREAT** dropdown at the bottom of the chat pane injects a threat prompt directly into the input field. Threats are grouped by category. Use this to manually test individual prompts through the live pipeline without running the full batch.

---

## Scan Badges

Each chat message header shows compact badges as gates complete:

```
SAFE-851MS   SAFE-2.0S   SAFE-3.8S
```

In Audit Mode, a badge turns red and shows the blocking gate when a prompt or response is blocked. Click any badge to open the API Inspector entry for that turn.

In Demo Mode, scan badges are hidden.

---

## Testing & Verification

Before a demo or security assessment, run the gate verification tests in **[TESTING.md](TESTING.md)** to confirm every service is reachable and every gate is behaving as expected.

The guide covers:

- **Quick Health Check** — four `curl` commands to verify Ollama, the Node proxy, LLM-Guard, and Little-Canary are all up before you start
- **11 numbered gate tests** — step-by-step instructions for manually triggering each gate (LLM-Guard input/output, Semantic-Guard, Little-Canary, AIRS-Inlet, AIRS-Dual), plus API Inspector, Live Telemetry, Static Batch Runner, and Dynamic Probe
- **Direct sidecar tests** — raw `curl` commands for LLM-Guard and Little-Canary so you can verify the Python services independently of the UI
- **Troubleshooting table** — common failure modes with likely causes and fixes (connection refused, model not found, HuggingFace download errors, AIRS auth failures, and more)
- **Tips** — shortcuts, scan badge navigation, warmup and offline mode for LLM-Guard

→ **[TESTING.md](TESTING.md)**

---

## Technical Reference Index

| Doc | Contents |
| :--- | :--- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Component diagram, traffic routing, Node proxy design |
| **[SECURITY-GATES.md](SECURITY-GATES.md)** | **Security gates — pipeline overview, one-paragraph summary per gate** |
| ↳ [GATE-LLM-GUARD.md](GATE-LLM-GUARD.md) | LLM-Guard — all 13 scanners, HuggingFace models, thresholds, sidecar API |
| ↳ [GATE-SEMANTIC-GUARD.md](GATE-SEMANTIC-GUARD.md) | Semantic-Guard — LLM-as-judge, exact prompts, verdict schema, judge model guide |
| ↳ [GATE-LITTLE-CANARY.md](GATE-LITTLE-CANARY.md) | Little-Canary — detection patterns, model recommendations, Flask API |
| ↳ [GATE-AIRS.md](GATE-AIRS.md) | AIRS — REST API, SDK sidecar, DLP, enforcement modes |
| **[Red Teaming]** | |
| ↳ [RED-TEAM-STATIC.md](RED-TEAM-STATIC.md) | Static Batch Runner — threat library, 6-gate pipeline, exports |
| ↳ [RED-TEAM-DYNAMIC.md](RED-TEAM-DYNAMIC.md) | Dynamic Probe — PAIR algorithm, attacker/judge prompts, gate trace |
| [TESTING.md](TESTING.md) | Gate verification tests and troubleshooting |
