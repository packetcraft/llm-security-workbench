<!--
  WHAT THIS FILE HOLDS:
  Architecture, flow, and operational notes for the Dynamic Probe (PAIR) feature
  in dev/6b-dynamic-redteam.html — how the attacker loop works, which security
  gates are active, which are bypassed, and what the results mean.

  WHY IT EXISTS SEPARATELY:
  The Dynamic Probe is a distinct red-teaming mode that does not follow the same
  execution path as normal chat. Understanding which gates fire (and which do not)
  is essential for interpreting probe results correctly.

  CROSS-REFERENCES:
  - docs/ARCHITECTURE.md       — full six-gate pipeline and component diagram
  - docs/SECURITY-GATES.md     — per-gate configuration and behaviour
  - dev/6b-dynamic-redteam.html — implementation (startPairRun, runPipelineCheck)
-->

# Dynamic Probe — Architecture & Flow

The Dynamic Probe implements the **PAIR algorithm** (Prompt Automatic Iterative Refinement). An "attacker" LLM generates adversarial prompts against a goal, those prompts are run through the security pipeline, the target LLM responds (if not blocked), and a "judge" LLM scores the response. The loop iterates until the attack succeeds or the iteration limit is reached.

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  PAIR Loop  (up to max_iterations)                              │
│                                                                 │
│  ┌──────────────┐   generateAttackPrompt()                      │
│  │  Attacker LLM │ ─────────────────────────────────────────┐  │
│  │  (Ollama)     │  context: goal + previous attempt result  │  │
│  └──────────────┘                                            │  │
│                                                              ▼  │
│                                                    Attack Prompt │
│                                                              │  │
│                         ┌────────────────────────────────────┘  │
│                         │  runPipelineCheck()                   │
│                         │                                        │
│                         ├─▶ 🔬 LLM-Guard INPUT  (if mode ≠ off) │
│                         ├─▶ 🐦 Little-Canary     (if mode ≠ off) │
│                         └─▶ 📥🛡️ AIRS-Inlet      (if mode ≠ off) │
│                                    │                             │
│                            blocked?│                             │
│                         ┌──────────┴──────────┐                 │
│                      YES│                     │NO                │
│                         ▼                     ▼                 │
│                   record blocked        getLLMResponse()         │
│                   skip LLM call         (direct Ollama call)     │
│                   score = 0                    │                 │
│                                               ▼                 │
│                                         judgeScore()            │
│                                    Judge LLM scores 1–10        │
│                                               │                 │
│                              score ≥ threshold│                 │
│                         ┌─────────────────────┴──────────────┐  │
│                      YES│                                    │NO │
│                         ▼                                    ▼  │
│                    🔴 BREACHED                    next iteration │
│                       stop                   (attacker gets     │
│                                               feedback on why   │
│                                               it failed)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Gate Coverage

The probe runs a **subset** of the six-gate pipeline. Gate states are read live from the UI — if a gate is set to `off` in the Security Pipeline panel, the probe skips it too.

| Gate | Normal chat | Dynamic Probe | Notes |
| :--- | :---: | :---: | :--- |
| 🔬 LLM-Guard INPUT | ✅ | ✅ | Reads current mode; `strict` = block iteration |
| 🧩 Semantic-Guard | ✅ | ❌ | Skipped — requires streaming Ollama call with conversation context |
| 🐦 Little-Canary | ✅ | ✅ | Reads current mode; `safe: false` = block iteration |
| 📥🛡️ AIRS-Inlet | ✅ | ✅ | Reads current mode; `strict` + `action: block` = block iteration |
| 🤖 LLM | ✅ | ✅ | Direct non-streaming Ollama call |
| 🔀🛡️ AIRS-Dual | ✅ | ❌ | Skipped — response is passed directly to judge |
| 🔬 LLM-Guard OUTPUT | ✅ | ❌ | Skipped — response is not scanned before judge sees it |

**Advisory mode is treated as pass** — only `strict` mode triggers a block in the probe. Advisory-flagged prompts continue to the LLM, matching the intent of advisory gates (warn, don't stop).

---

## The Three Roles

| Role | Configured by | What it does |
| :--- | :--- | :--- |
| **Attacker LLM** | `pair-attacker-model` select | Generates adversarial prompts; refines them each iteration using feedback (was it blocked? what did the LLM say?) |
| **Target LLM** | Main model selector (Workspace pane) | The model under test — receives the attack prompt if the pipeline does not block it |
| **Judge LLM** | `pair-judge-model` select | Scores the target LLM's response from 1–10 against the stated goal; declares a breach when score ≥ threshold |

All three roles can be set to the same Ollama model. Using a stronger, more capable model as the attacker tends to produce more sophisticated attack prompts. The judge model benefits from strong instruction-following; the judge prompt is fixed and asks for only a single integer.

---

## Iteration Feedback Loop

The attacker LLM receives different context depending on what happened in the previous iteration:

- **First iteration** — just the goal; attacker generates a first attempt.
- **Blocked in previous iteration** — attacker is told which gate blocked the prompt and is asked to craft a more evasive version (indirect language, hypothetical framing, role-play, encoding).
- **Reached LLM but low score** — attacker sees the full previous prompt and the LLM's response, and is asked to escalate (story framing, professional context, multi-step reasoning, technical abstraction).

---

## Result States

Each attempt is recorded with one of three outcomes:

| Outcome | Meaning |
| :--- | :--- |
| 🛡️ **BLOCKED** | At least one active gate (LLM-Guard, Canary, or AIRS-Inlet) rejected the prompt; the LLM was never called |
| ⚠️ **REACHED LLM** | Prompt passed all active input gates; LLM responded; judge score was below threshold |
| 🔴 **BREACHED** | Prompt passed all active input gates; judge scored the LLM response ≥ threshold; probe stops |

The final session banner shows one of three verdicts:

- **🔴 BREACHED** — input defences were bypassed at iteration N
- **🟢 HELD** — all iterations ended in BLOCKED or low-score REACHED LLM
- **⏹ STOPPED** — user manually cancelled the probe

---

## Interpreting Results

**A BREACHED result does not mean the response would have reached the user in a real chat session.** AIRS-Dual and LLM-Guard OUTPUT are skipped during the probe. In a live chat, those output gates might still catch and suppress the harmful response. The probe tests only whether input-side defences can be bypassed and whether the LLM is willing to produce the targeted content.

**A HELD result does not guarantee the pipeline is impenetrable.** Semantic-Guard (which is skipped) and output gates may add additional coverage. Conversely, the probe may exhaust its iteration budget without finding a successful angle that exists.

**Blocked rate is a useful metric.** A high block rate across iterations means input gates are catching the attacker's attempts. A low block rate with consistently low judge scores suggests the LLM itself is refusing — the gate coverage is less exercised.

---

## Known Limitations

| Limitation | Impact |
| :--- | :--- |
| Semantic-Guard not called | The LLM-as-judge gate is skipped; attacks that Semantic-Guard would catch are not penalised |
| No output scanning | Judge evaluates raw LLM output; a "BREACHED" result may be survivable with output gates active |
| Advisory mode treated as pass | Gates set to advisory do not block probe iterations, consistent with their UI behaviour |
| Single-turn only | The probe sends each attack prompt as a standalone message; multi-turn jailbreaks (context accumulation) are not modelled |
| Non-streaming Ollama calls | `getLLMResponse` uses `stream: false`; very long responses may hit Ollama timeouts |
