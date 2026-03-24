<!--
  WHAT THIS FILE HOLDS:
  Verification steps, gate-by-gate test cases, troubleshooting table, and
  usage tips for the LLM Security Workbench.

  WHY IT EXISTS SEPARATELY:
  Test procedures and troubleshooting steps are operational content — useful
  during setup and debugging but not part of the project overview. Keeping them
  here keeps README.md concise while still providing a full testing reference.

  CROSS-REFERENCES:
  - docs/SECURITY-GATES.md  — gate internals and configuration
  - docs/5-SETUP-GUIDE.md   — installation and startup instructions
  - docs/ARCHITECTURE.md    — system flow reference
-->

# Testing & Verification

## Gate Verification Tests

### Test 0 — Semantic-Guard

1. In the **🧩 Semantic-Guard** panel, set the mode to **Strict — block on fail**.
2. Expand **⚙️ Guardrail Settings** and select a small, fast judge model (e.g. `llama3.2:3b`).
3. Leave the confidence threshold at **0.70**.
4. Select the **Jailbreak** or **Prompt Injection** threat from the Insert Threat dropdown.
5. Click **Send Message**.

✅ Success: A purple `🧩 SEMANTIC-GUARD — PROMPT BLOCKED` alert appears with the confidence score and reason. AIRS is never called.

---

### Test 1 — Verify Ollama

```bash
curl http://localhost:11434/api/tags
```

✅ Success: JSON list of your downloaded models.

---

### Test 2 — AIRS-Inlet (Prompt Block)

1. Enter your Prisma API Key (`x-pan-token`).
2. Set AIRS mode to **Strict (Pre-Flight Block)**.
3. Select the **DLP** threat from the Insert Threat dropdown.
4. Click **Send Message**.

✅ Success: A red `🛑 PRISMA AIRS — PROMPT BLOCKED` alert appears. The LLM is never called.

---

### Test 3 — AIRS-Dual (Response Scan + DLP Masking)

1. Keep AIRS mode on **Audit Only (Twin-Scan)**.
2. Use the **PII Shield** persona.
3. Ask: *"Generate a sample employee record including SSN and credit card."*
4. Click **Send Message**.

✅ Success: The LLM response is generated, then scanned. If DLP fires, the response is shown with sensitive fields masked (`XXXXXXXXXXXX`) and a `⚠️ Masked` badge appears on the bot message.

---

### Test 4 — Little-Canary

1. Start the canary service: `npm run canary`
2. Navigate to `http://localhost:3080/dev/6a`
3. In the **🐦 Little-Canary** panel, set mode to **Full — block high-confidence attacks**.
4. Expand **⚙️ Canary Settings** and select a small model (`qwen2.5:1.5b`).
5. Select the **Prompt Injection** or **Jailbreak** threat and click **Send Message**.

✅ Success: An orange `🐦 LITTLE CANARY — PROMPT BLOCKED` alert appears. AIRS and the LLM are never called.

**Advisory mode test:**
1. Set mode to **Advisory — flag & inject warning**.
2. Send the same injection prompt.

✅ Success: A yellow advisory banner appears in chat. Execution continues — the Ollama system prompt receives the canary warning prefix prepended to it.

---

### Test 5 — API Inspector

Click the **🛠️ API Inspector** icon in the rail sidebar. In `dev/6a` (and `dev/5d`) you'll see seven collapsible accordion sections in pipeline order — one per gate — showing the full request payload and raw verdict JSON:

| Column | Shows |
| :--- | :--- |
| 🔬 LLM-GUARD INPUT | Scan payload + per-scanner results |
| 🧩 SEMANTIC-GUARD | Judge request + verdict (safe, confidence, reason) |
| 🐦 LITTLE-CANARY | Canary payload + verdict (safe, summary, advisory) |
| ☁︎ AIRS-INLET | AIRS prompt scan request + verdict |
| 🤖 OLLAMA | LLM request payload + last stream chunk |
| ☁︎ AIRS-DUAL (Phase 2) | AIRS response scan request + verdict |
| 🔬 LLM-GUARD OUTPUT | Scan payload + per-scanner results |

All columns reset to "Waiting..." when a new prompt is sent. Gates set to Off show "Disabled." immediately.

---

### Test 6 — LLM Guard Sidecar

1. Start the LLM Guard sidecar: `npm run llmguard`
2. Check health: `http://localhost:5002/health`
   - After the first prompt, `loaded_input_scanners` and `loaded_output_scanners` should list all active scanners.
3. In the **🔬 LLM-Guard** panel, set mode to **Strict**.
4. Send a prompt containing an obvious injection pattern.

✅ Success: A `🔬 LLM-GUARD — PROMPT BLOCKED` alert appears before any other gate is reached.

---

### Test 7 — Personas

| Persona | Test Prompt |
| :--- | :--- |
| **Code Architect** | *"Write a Python async web scraper."* |
| **ELI5** | *"Explain transformer models using a metaphor."* |
| **Socratic Tutor** | *"Why is the French Revolution important?"* |

---

## Troubleshooting

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **"Offline" in Model Dropdown** | Ollama CORS not configured | Redo the Ollama CORS setup in README.md, fully quit Ollama before restarting |
| **"Failed to fetch" on Send** | Ollama not running | Run `ollama serve` in terminal |
| **Prisma Proxy Error 500** | Node proxy can't reach Palo Alto | Check internet / verify `x-pan-token` |
| **Cannot find module 'express'** | Dependencies not installed | Run `npm install` |
| **Cannot find module 'dotenv'** | `npm install` not re-run after `.env` support was added | Run `npm install` then `npm start` |
| **API key field stays editable despite `.env`** | Server not running or `/api/config` unreachable | Ensure `npm start` is running; `.env` is only loaded by the Node proxy |
| **Profile not pre-selected from `.env`** | `AIRS_PROFILE` not set in `.env` | Add `AIRS_PROFILE=your-profile-name` to `.env` and restart |
| **Phase 2 / AIRS-Dual scan not running** | Streaming was stopped early | AIRS-Dual only runs on complete responses |
| **Little Canary 502 Bad Gateway** | Flask microservice not running | Run `npm run canary` in a separate terminal |
| **`ModuleNotFoundError: little_canary`** | Python package not installed | Run `pip install flask little-canary` |
| **Canary model not appearing in dropdown** | Ollama hasn't pulled the model | Run `ollama pull qwen2.5:1.5b` |
| **LLM Guard "service unavailable"** | Flask sidecar not running | Run `npm run llmguard` in a separate terminal |
| **LLM Guard install fails (Python version error)** | Wrong Python version | Use `py -3.12` explicitly — llm-guard requires Python 3.9–3.12 |
| **LLM-Guard flagging "hi" or "good morning"** | Language/Gibberish scanners | Leave Language and Gibberish unchecked (default off) |

---

## Usage Tips

* **Sidebar:** Click the 🛡️ icon at the top of the icon rail to toggle the nav panel open or closed.
* **Keyboard hint:** `Shift + Enter` for a new line in the prompt box.
* **Security panel modes:** All gates use a single mode select (Off / Audit or Advisory / Strict or Full). The panel border and header status dot change colour to reflect the current mode — grey (off), yellow (audit), red/purple (strict).
* **Model Parameters:** Expand **⚙️ Model Parameters** under the model selector to tune Temperature, Top P, Top K, and Repeat Penalty. Hover the **ℹ** badge on any slider for an explanation.
* **Semantic-Guard without AIRS:** Semantic-Guard runs entirely over `localhost:11434` — no API key needed. It can be used standalone with AIRS mode set to Off for fully offline safety testing.
* **Insert Threat:** Use the dropdown to load pre-built adversarial prompts into the prompt box.
* **API Inspector:** Expand at the bottom to inspect all phases in real-time. Panels clear automatically on every new prompt.
* **Latency reading:** Scan badge timings measure the raw API round-trip for each gate. The `🤖` pill on the AI message covers the full Ollama stream — useful for comparing model sizes or spotting slow AIRS profiles.
* **Custom Profiles:** Expand **⚙️ AIRS Settings** then click **➕ Add Custom Security Profile** to enter your organisation's AIRS Profile ID.
* **Little-Canary Advisory mode:** Prefer Advisory over Full when starting out — it injects a warning into the system prompt rather than hard-blocking, so you can observe how the LLM handles the flagged input.
* **Little-Canary without AIRS:** Little-Canary runs entirely over `localhost` via the Flask microservice — no API key needed. It can be used standalone with AIRS mode set to Off.
* **Copy response:** Each AI response has a **📋 Copy** button in the message header.
* **Batch Threat Runner:** Run all 68 adversarial threats through the full pipeline automatically. Export results as JSON or Markdown. The summary bar shows catches per gate.
