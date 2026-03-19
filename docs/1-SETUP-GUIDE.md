<!--
  SCOPE: This guide covers dev/1a, dev/1b, and dev/2a only.
  These are the entry-level HTML files — minimal Ollama chat and AIRS prompt-gate demo.
  For the full six-gate pipeline (dev/5a / dev/5b), see docs/5-SETUP-GUIDE.md.
  Files dev/3xx and dev/4xx are intermediate builds not covered by any standalone guide.
-->

# Getting Started — LLM Security Workbench
### `dev/1a` · `dev/1b` · `dev/2a`

This guide covers the entry-level workbench files from scratch. No prior installation is assumed.

---

## What These Files Are

| File | Title | What it does |
|:---|:---|:---|
| `dev/1a-ollama-chat-no-security.html` | My Custom Ollama Chat | Minimal chat UI. Talks directly to a local Ollama model. No security layer, no server required. |
| `dev/1b-mechat-no-security.html` | meChat — No Security | Styled terminal chat. Fetches available Ollama models dynamically. Supports selectable personas. No security layer, no server required. |
| `dev/2a-mechat-airs-teaching-demo.html` | AIRS Teaching — Prompt Scan Gate | Adds a cloud security gate before the LLM. Every prompt is scanned by Prisma AIRS before being sent to Ollama. Requires the Node.js proxy server and an AIRS API key. |

**Start with `1a`** to verify Ollama is working. Move to `1b` for a nicer UI, then `2a` to see what a security gate looks like in practice.

---

## Prerequisites

| Requirement | Version | Notes |
|:---|:---|:---|
| Ollama | Latest | Local LLM runtime — required for all three files |
| Node.js | 18+ | Required for `2a` only — runs the proxy server |
| npm | 9+ | Bundled with Node.js |
| Git | Any | To clone the repo |

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

---

## Step 2 — Pull a Model

`1a` is hardcoded to `llama3.2:3b`. `1b` auto-discovers installed models. `2a` works with any chat model.

```bash
ollama pull llama3.2:3b
```

**Start Ollama** (if not already running as a background service):
```bash
ollama serve
```

Verify: http://localhost:11434 should return `"Ollama is running"`.

---

## Step 3 — Clone the Repository

```bash
git clone https://github.com/packetcraft/llm-security-workbench.git
cd llm-security-workbench
```

---

## Running `1a` and `1b` — No Server Required

Both files talk directly to Ollama on `http://localhost:11434`. No Node.js server needed.

Open the file directly in your browser:

```
dev/1a-ollama-chat-no-security.html
dev/1b-mechat-no-security.html
```

> **Windows tip:** Right-click the file → *Open with* → your browser, or drag it into the address bar.

Type a message and press Send. The response streams from your local Ollama model.

### What you're seeing

- **`1a`** — Plain light-mode chat. Hardcoded to `llama3.2:3b`. The simplest possible Ollama integration — a single `fetch` to Ollama, no frills.
- **`1b`** — Dark terminal UI. Auto-fetches the model list from Ollama. Includes a persona selector that prepends a system prompt to each message.

Neither file has any security scanning — prompts go straight to Ollama and responses come straight back. This is the no-security baseline.

---

## Running `2a` — AIRS Prompt Gate

`2a` routes API calls through a Node.js proxy so the AIRS API key is never exposed in browser JavaScript. The proxy must be running before opening the page.

### Step A — Install Node.js dependencies

```bash
npm install
```

### Step B — Configure your AIRS API key

Create a `.env` file in the project root (same folder as `package.json`):

```bash
# .env  (never commit this file — it's already in .gitignore)
AIRS_API_KEY=your-x-pan-token-here
```

An `.env.example` template is included. If you don't have a key yet, you can also enter it directly in the workbench UI — but `.env` is preferred so you don't retype it on each reload.

> **Where to get an AIRS key:** Prisma Cloud tenant → **AI Security** → **API Keys** → generate a key.

### Step C — Start the proxy server

```bash
npm start
```

Expected output:
```
🚀 Workbench running at http://localhost:3080
🛡️ Prisma AIRS Proxy active on /api/prisma
```

### Step D — Open the workbench

Navigate to: **http://localhost:3080/dev/2a**

### What you're seeing

Every prompt is scanned by Prisma AIRS **before** it reaches Ollama:

```
Your prompt
    │
    ▼
📥🛡️ AIRS Prompt Scan  (cloud — Prisma AIRS)
    │
    ├── BLOCKED  → message rejected, reason shown, Ollama never called
    ├── FLAGGED  → warning shown, Ollama still called (advisory mode)
    └── CLEAN    → Ollama called normally
    │
    ▼
🤖 Ollama response
```

The scan verdict, latency, and any detected threat category are shown inline in the chat.

---

## Quick Reference

| Command | What it does |
|:---|:---|
| `npm start` | Start the Node.js proxy on :3080 (required for `2a`) |
| `npm run stage 2a` | Copy `dev/2a-*.html` → `src/index.html` (makes it the default at `/`) |

---

## Troubleshooting

**Ollama models not appearing / "Failed to connect"**
- Ensure `ollama serve` is running
- Check http://localhost:11434 returns `"Ollama is running"`
- Pull a model: `ollama pull llama3.2:3b`

**`1a` sends a message but gets no response**
- Open browser DevTools (F12) → Console — look for a CORS or network error
- The model hardcoded in `1a` is `llama3.2:3b` — confirm it's pulled: `ollama list`

**`2a` shows "AIRS key not configured"**
- Ensure `.env` is in the project root (same folder as `package.json`)
- Restart `npm start` after editing `.env`
- The UI shows `🔒 .env` next to the key field when loaded correctly

**`2a` page not loading / "Cannot GET /dev/2a"**
- Ensure `npm start` is running — the proxy server must be up
- Navigate to http://localhost:3080/dev/2a, not a `file://` path

**npm install fails**
- Ensure Node.js 18+ is installed: `node --version`
- Run from the project root (the folder containing `package.json`)

---

## Directory Structure

```
llm-security-workbench/
├── dev/
│   ├── 1a-ollama-chat-no-security.html    ← minimal Ollama chat (no server)
│   ├── 1b-mechat-no-security.html         ← styled terminal chat (no server)
│   └── 2a-mechat-airs-teaching-demo.html  ← AIRS prompt gate (needs server)
├── src/
│   └── server.js                          ← Node proxy :3080 (needed for 2a)
├── .env                                   ← your AIRS API key (gitignored)
├── .env.example                           ← safe template to commit
└── package.json
```

---

## Next Steps

`2a` shows a single-gate prompt scan. The full six-gate pipeline (LLM-Guard → Semantic-Guard → Little-Canary → AIRS-Inlet → LLM → AIRS-Dual → LLM-Guard OUTPUT) is covered in:

→ **`docs/5-SETUP-GUIDE.md`**
