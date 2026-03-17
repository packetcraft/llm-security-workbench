# 🛡️ Ollama Pro Workbench v2.3 (Twin-Scan Edition)

A professional, local-first web interface for interacting with Ollama LLMs, secured by **Palo Alto Networks Prisma AIRS** with enterprise-grade two-phase scanning — protecting both the prompt going in and the response coming out.

## ✨ Key Features

* **Two-Phase AIRS Scanning:** Scans the user prompt (pre-flight) AND the LLM response (post-generation) — not just one side of the conversation.
* **DLP Response Masking:** If Prisma AIRS detects sensitive data in the LLM response, the masked version is displayed instead.
* **Zero-CORS Security Proxy:** A local Node.js proxy routes all AIRS API calls, bypassing browser CORS restrictions.
* **Three Enforcement Modes:** Strict (block), Audit (flag and continue), or Off.
* **API Inspector (Twin-Scan View):** Three-column debug panel showing Phase 1 request/verdict, Ollama payload, and Phase 2 request/verdict side-by-side.
* **Dynamic Persona Library:** Built-in and custom personas with `localStorage` persistence.
* **Threat Library:** 19 pre-loaded adversarial prompts across categories: injection, DLP, evasion, toxic content, malicious URLs, and more.

---

## 🔄 Security Flow

```mermaid
flowchart TD
    A([👤 User Prompt]) --> B

    subgraph PHASE1 ["🔍 Phase 1 — Pre-Flight Prompt Scan"]
        B[AIRS Scan\ncontents: prompt] --> C{Verdict}
    end

    C -- "🛑 BLOCK · Strict" --> D([Prompt Blocked\nLLM not reached])
    C -- "⚠️ BLOCK · Audit" --> E([Warn user\nContinue to LLM])
    C -- "✅ ALLOW" --> F

    E --> F

    subgraph LLM ["🤖 LLM Execution"]
        F[Ollama streaming\nCollect full response]
    end

    F --> G

    subgraph PHASE2 ["🔍 Phase 2 — Post-Response Scan"]
        G[AIRS Scan\ncontents: prompt + response] --> H{Verdict}
    end

    H -- "🛑 BLOCK · Strict" --> I([Response replaced\nwith block notice])
    H -- "⚠️ BLOCK · Audit" --> J([Warn + show response\nor masked version])
    H -- "⚠️ DLP Masked" --> K([Sensitive data masked\nby AIRS])
    H -- "✅ ALLOW" --> L([Response displayed\nnormally])
```

---

## ⚙️ Architecture Overview

This app uses a **split-routing architecture** to keep LLM traffic local while routing security scans through the cloud:

| Traffic | Route |
| :--- | :--- |
| Security scans | Browser → Local Node Proxy `:3080` → Prisma AIRS API |
| LLM inference | Browser → Local Ollama API `:11434` |

The Node.js proxy exists solely to bypass CORS restrictions — your prompts and responses are never stored or forwarded anywhere else.

---

## 🚀 Step 1: Configure Ollama (Required)

By default, Ollama blocks requests from web browsers. You must explicitly allow it.

### 🍏 macOS
```bash
launchctl setenv OLLAMA_ORIGINS "*"
launchctl setenv OLLAMA_HOST "0.0.0.0"
```
Then relaunch Ollama from the menu bar.

### 🪟 Windows
1. Quit Ollama (system tray → Quit).
2. Open **Edit the system environment variables** → **User variables** → **New...**
   - `OLLAMA_ORIGINS` = `*`
   - `OLLAMA_HOST` = `0.0.0.0`
3. Relaunch Ollama.

---

## 📦 Step 2: Install the Workbench

**Prerequisites:** [Node.js](https://nodejs.org/) installed.

```bash
git clone https://github.com/packetcraft/Prisma-AIRS-with-ollama.git
cd Prisma-AIRS-with-ollama
npm install
```

---

## 🏃 Step 3: Run

```bash
npm start
```

Open **`http://localhost:3080`** in your browser.
*(You should see `🚀 Workbench running at http://localhost:3080` in your terminal.)*

---

## 🗂️ Step 4: Choose Your Starting Point

The `dev/` folder contains four HTML files that represent a progressive build-up from a bare chat to a fully secured workbench. Copy the one that matches your use case to `src/index.html` to serve it via the proxy.

```bash
# Example — copy the teaching demo to the server
cp dev/2a-mechat-airs-teaching-demo.html src/index.html
```

| File | Use Case | AIRS? | Key Features |
| :--- | :--- | :---: | :--- |
| `1a-ollama-chat-no-security.html` | **Baseline** — understand Ollama chat with zero security | ✗ | Single `fetch` to Ollama, no frills |
| `1b-mechat-no-security.html` | **Bridge** — same meChat UI before introducing AIRS | ✗ | Personas, live model dropdown, terminal theme |
| `2a-mechat-airs-teaching-demo.html` | **Teaching demo** — introduce AIRS as a prompt gate | ✓ | Prompt scan, inline verdict badge, AIRS on/off toggle, curl + async explainer comments |
| `3a-ollama-pro-workbench-twin-scan.html` | **Full workbench** — production-grade twin-scan | ✓ | Phase 1 + Phase 2 scanning, DLP masking, strict/audit/off modes, threat library, API inspector |

### Recommended learning path

```
1a  →  understand the LLM call with no security
1b  →  add UI polish (personas, model selector) — still no security
2a  →  introduce AIRS: one fetch → one verdict → gate the LLM
3a  →  graduate to twin-scan: secure both ingress and egress
```

> **Config reminder:** `1b` and `2a` have a `HARDCODED CONFIG` block at the top of the `<script>` — fill in `AIRS_API_KEY` and `AIRS_PROFILE` before running. `3a` exposes these as UI fields.

---

## 🧪 Step 5: Verification & Testing

### Test 1 — Verify Ollama
```bash
curl http://localhost:11434/api/tags
```
*✅ Success: JSON list of your downloaded models.*

### Test 2 — Test Phase 1 (Prompt Block)
1. Enter your Prisma API Key (`x-pan-token`).
2. Set AIRS mode to **Strict (Pre-Flight Block)**.
3. Select the **DLP** threat from the Insert Threat dropdown.
4. Click **Send Message**.

*✅ Success: A red `🛑 PRISMA AIRS — PROMPT BLOCKED` alert appears. The LLM is never called.*

### Test 3 — Test Phase 2 (Response Scan)
1. Keep AIRS mode on **Audit Only (Twin-Scan)**.
2. Use the **PII Shield** persona.
3. Ask: *"Generate a sample employee record including SSN and credit card."*
4. Click **Send Message**.

*✅ Success: The LLM response is generated, then scanned. If DLP fires, the response is shown with sensitive fields masked (`XXXXXXXXXXXX`) and a `⚠️ Masked` badge appears on the bot message.*

### Test 4 — API Inspector
Click the **🛠️ API Inspector** bar at the bottom. You'll see three columns:
- **Phase 1** — Prompt scan request & AIRS verdict
- **Ollama** — LLM request payload & last stream chunk
- **Phase 2** — Response scan request & AIRS verdict

### Test 5 — Personas
| Persona | Test Prompt |
| :--- | :--- |
| **Code Architect** | *"Write a Python async web scraper."* |
| **ELI5** | *"Explain transformer models using a metaphor."* |
| **Socratic Tutor** | *"Why is the French Revolution important?"* |

---

## ⚠️ Step 6: Troubleshooting

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **"Offline" in Model Dropdown** | Ollama CORS not configured | Redo Step 1, fully quit Ollama before restarting |
| **"Failed to fetch" on Send** | Ollama not running | Run `ollama serve` in terminal |
| **Prisma Proxy Error 500** | Node proxy can't reach Palo Alto | Check internet / verify `x-pan-token` |
| **Cannot find module 'express'** | Dependencies not installed | Run `npm install` |
| **Phase 2 scan not running** | Streaming was stopped early | Phase 2 only runs on complete responses |

---

## 🛠️ Step 7: Usage Tips

* **Sidebar:** Click **◀ Sidebar** to collapse the left panel and give chat full width.
* **Keyboard hint:** `Shift + Enter` for a new line in the prompt box.
* **Insert Threat:** Use the dropdown to load pre-built adversarial prompts into the prompt box.
* **API Inspector:** Expand at the bottom to inspect raw Phase 1, Ollama, and Phase 2 payloads in real-time.
* **Custom Profiles:** Click **➕ Add Custom Security Profile** to enter your organisation's Prisma AIRS Profile ID.
* **Copy response:** Each AI response has a **📋 Copy** button in the message header.
