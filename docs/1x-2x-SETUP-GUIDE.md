# Getting Started — LLM Security Workbench
### `dev/1a` · `dev/1b` · `dev/2a`

This guide walks through a complete from-scratch setup for the entry-level workbench files. No prior installation is assumed.

---

## What These Files Are

| File | Title | What it does |
|:---|:---|:---|
| `dev/1a-ollama-chat-no-security.html` | My Custom Ollama Chat | Minimal chat UI. Talks directly to a local Ollama model. No security layer, no server required. |
| `dev/1b-mechat-no-security.html` | meChat — No Security | Styled terminal chat. Fetches available Ollama models dynamically. Supports selectable personas. No security layer, no server required. |
| `dev/2a-mechat-airs-teaching-demo.html` | AIRS Teaching — Prompt Scan Gate | Adds a cloud security gate before the LLM. Every prompt is scanned by Prisma AIRS before being sent to Ollama. Requires the Node.js proxy server and an AIRS API key. |

**Start with `1a`** if you just want to verify Ollama is working. Move to `1b` for a nicer UI, then `2a` to see what a security gate looks like in practice.

---

## Prerequisites

| Requirement | Version | Notes |
|:---|:---|:---|
| Node.js | 18+ | Required for `2a` only — runs the proxy server |
| npm | 9+ | Bundled with Node.js |
| Ollama | Latest | Local LLM runtime — required for all three files |
| Git | Any | To clone the repo |

---

## Step 1 — Install Ollama

Ollama runs LLM models locally on your machine.

**macOS / Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download the installer from https://ollama.com/download and run it.

**Verify installation:**
```bash
ollama --version
```

---

## Step 2 — Pull a Model

`1a` uses `llama3.2:3b` by default. `1b` auto-discovers whatever models you have installed. `2a` works with any chat model.

Pull the recommended model:
```bash
ollama pull llama3.2:3b
```

> First pull takes a few minutes depending on your connection. Models are stored in `~/.ollama/models/` and only downloaded once.

**Start Ollama** (if not already running as a background service):
```bash
ollama serve
```

Verify it's up: http://localhost:11434 should return `"Ollama is running"`.

---

## Step 3 — Clone the Repository

```bash
git clone https://github.com/packetcraft/llm-security-workbench.git
cd llm-security-workbench
```

---

## Running `1a` and `1b` — No Server Required

Both `1a` and `1b` talk directly to Ollama on `http://localhost:11434`. No Node.js server is needed.

Open either file directly in your browser:

```
dev/1a-ollama-chat-no-security.html
dev/1b-mechat-no-security.html
```

> **Windows tip:** Right-click the file → *Open with* → your browser, or drag it into the browser address bar.

**That's it.** Type a message and press Send. The response streams from your local Ollama model.

### What you're seeing

- **`1a`** — Plain light-mode chat. Hardcoded to `llama3.2:3b`. The simplest possible Ollama integration.
- **`1b`** — Dark terminal UI. Auto-fetches the model list from Ollama so the dropdown shows whatever you have installed. Includes a persona selector that prepends a system prompt to each message.

Neither file has any security scanning — prompts go straight to Ollama and responses come straight back. This is the baseline to compare against the secured stages.

---

## Running `2a` — AIRS Prompt Gate

`2a` routes API calls through a Node.js proxy so the AIRS API key is never exposed in browser JavaScript. The proxy must be running before you open the page.

### Step A — Install dependencies

From the project root:
```bash
npm install
```

### Step B — Configure your AIRS API key

Create a `.env` file in the project root (same folder as `package.json`):

```bash
# .env  (never commit this file — it's already in .gitignore)
AIRS_API_KEY=your-x-pan-token-here
```

An `.env.example` template is included. If you don't have an AIRS key yet, you can also enter it directly in the workbench UI under the AIRS Settings panel — but the `.env` approach is preferred so you don't have to re-enter it on each reload.

> **Where to get an AIRS API key:** Log in to your Prisma Cloud tenant, navigate to **AI Security** → **API Keys**, and generate a key. The key format is a long alphanumeric token used in the `x-pan-token` header.

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

Every prompt you submit is scanned by Prisma AIRS **before** it reaches Ollama:

```
Your prompt
    │
    ▼
🛡️ AIRS Prompt Scan  (cloud — Prisma AIRS)
    │
    ├── BLOCKED  → message rejected, reason shown, Ollama never called
    ├── FLAGGED  → warning shown, Ollama still called (advisory mode)
    └── CLEAN    → Ollama called normally
    │
    ▼
🤖 Ollama response
```

The UI shows the scan result inline in the chat — verdict, latency, and any threat category detected. This is the teaching demo for understanding what a prompt security gate does and how different prompts are treated.

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
- Pull a model if none are installed: `ollama pull llama3.2:3b`

**`1a` sends a message but gets no response**
- Open browser DevTools (F12) → Console — look for a CORS or network error
- Ollama must be running on port 11434
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

## Directory Structure (entry-level files)

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

Once you're comfortable with `2a`, the next stages add more security layers:

| Stage | What's added |
|:---|:---|
| `dev/3a` | Response scanning — AIRS scans the LLM output too |
| `dev/4a` | Native guardrail — local LLM-as-judge before AIRS |
| `dev/5a` | Full six-gate pipeline — LLM Guard, Little Canary, AIRS, local guardrail |

See `docs/5a-SETUP-GUIDE.md` for the full pipeline setup.
