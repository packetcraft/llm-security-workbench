<!--
  WHAT THIS FILE HOLDS:
  Full system architecture for the LLM Security Workbench — component diagram,
  traffic routing table, six-gate security flow diagram, and Node proxy design notes.

  WHY IT EXISTS SEPARATELY:
  These diagrams and routing details are too detailed for README.md but are the
  authoritative reference for anyone building on top of, extending, or debugging
  the workbench infrastructure. README.md links here for readers who need depth.

  CROSS-REFERENCES:
  - docs/SECURITY-GATES.md  — per-gate logic and configuration details
  - docs/5-SETUP-GUIDE.md   — how to start each component
  - src/server.js           — the Node proxy implementation
-->

# Architecture

## Six-Gate Security Flow

When all six gates are active, every prompt passes through local transformer scanning, local LLM judgement, structural injection detection, and cloud scanning — before the LLM is called or the response is shown.

```mermaid
flowchart TD
    A([👤 User Prompt]) --> LG

    subgraph LG_IN ["🔬 LLM-Guard — Input (local :5002)"]
        LG[Transformer scanners\nInvisibleText · Secrets · PromptInjection · Toxicity · BanTopics] --> LGV{Verdict}
    end

    LGV -- "🔬 BLOCK · Strict" --> LGB([Prompt Blocked\nNo further gates reached])
    LGV -- "🔬 FLAGGED · Advisory" --> LGF([Warn user\nContinue to Semantic-Guard])
    LGV -- "✅ PASS" --> SG

    LGF --> SG

    subgraph PHASE0 ["🧩 Semantic-Guard (local Ollama)"]
        SG[LLM-as-judge\nformat:json · temp:0.1] --> SGV{Verdict}
    end

    SGV -- "🧩 BLOCK · Strict" --> SGB([Prompt Blocked\nNo API call made])
    SGV -- "🧩 FLAGGED · Audit" --> SGF([Warn user\nContinue to Little-Canary])
    SGV -- "✅ SAFE" --> LC

    SGF --> LC

    subgraph PHASE05 ["🐦 Little-Canary (local :5001)"]
        LC[Structural regex filter\n+ canary LLM probe] --> LCV{Verdict}
    end

    LCV -- "🐦 BLOCK · Full" --> LCB([Prompt Blocked\nNo API call made])
    LCV -- "🐦 ADVISORY" --> LCA([Warning prefix injected\ninto system prompt])
    LCV -- "✅ SAFE" --> AIRS1

    LCA --> AIRS1

    subgraph PHASE1 ["📥🛡️ AIRS-Inlet (cloud)"]
        AIRS1[Prisma AIRS scan\ncontents: prompt] --> A1V{Verdict}
    end

    A1V -- "📥🛡️ BLOCK · Strict" --> A1B([Prompt Blocked\nLLM not reached])
    A1V -- "📥🛡️ BLOCK · Audit" --> A1F([Warn user\nContinue to LLM])
    A1V -- "✅ ALLOW" --> LLM

    A1F --> LLM

    subgraph LLMGEN ["🤖 LLM Generation (local Ollama)"]
        LLM[Ollama streaming\nCollect full response]
    end

    LLM --> AIRS2

    subgraph PHASE2 ["🔀🛡️ AIRS-Dual (cloud)"]
        AIRS2[Prisma AIRS scan\ncontents: prompt + response] --> A2V{Verdict}
    end

    A2V -- "🔀🛡️ BLOCK · Strict" --> A2B([Response replaced\nwith block notice])
    A2V -- "⚠️ DLP Masked" --> A2M([Sensitive data masked\nby AIRS])
    A2V -- "✅ ALLOW" --> LGOUT

    A2M --> LGOUT

    subgraph LG_OUT ["🔬 LLM-Guard — OUTPUT (local :5002)"]
        LGOUT[Transformer scanners\nSensitive · MaliciousURLs · NoRefusal] --> LGOV{Verdict}
    end

    LGOV -- "🔬 BLOCK · Strict" --> LGOB([Response withheld])
    LGOV -- "🔬 FLAGGED · Advisory" --> LGOF([Response shown with warning])
    LGOV -- "✅ PASS" --> SHOW([Response displayed normally])
```

---

## Component Diagram

```mermaid
graph LR
    subgraph LOCAL ["🖥️  localhost"]
        direction TB

        subgraph BROWSER ["Browser (workbench UI)"]
            UI["LLM Security Workbench\ndev/6a · src/index.html"]
        end

        subgraph NODE ["Node.js · npm start · :3080"]
            PROXY["Express proxy\nsrc/server.js"]
        end

        subgraph LGFLASK ["Python · npm run llmguard · :5002"]
            LGSERV["Flask microservice\nservices/llm-guard/llmguard_server.py"]
            LGSCAN["ProtectAI LLM Guard\ntransformer scanners"]
            LGSERV --> LGSCAN
        end

        subgraph PYTHON ["Python · npm run canary · :5001"]
            FLASK["Flask microservice\nservices/canary/canary_server.py"]
            LC["little-canary\nSecurityPipeline"]
            FLASK --> LC
        end

        subgraph OLLAMA ["Ollama · ollama serve · :11434"]
            OLL["LLM inference\n/api/chat  /api/tags"]
        end
    end

    subgraph CLOUD ["☁️  cloud"]
        AIRS["Prisma AIRS API\nservice.api.aisecurity\n.paloaltonetworks.com"]
    end

    %% Browser → Node proxy
    UI -- "GET /  /api/config\nPOST /api/prisma\nPOST /api/canary\nPOST /api/llmguard-input\nPOST /api/llmguard-output" --> PROXY

    %% Browser → Ollama direct (streaming)
    UI -- "POST /api/chat  streaming\nGET /api/tags\nSemantic-Guard judge + chat LLM" --> OLL

    %% Node → Prisma AIRS (cloud)
    PROXY -- "POST /v1/scan/sync/request\nAIRS-Inlet prompt scan\nAIRS-Dual response scan" --> AIRS

    %% Node → LLM Guard Flask
    PROXY -- "POST /scan/input\nPOST /scan/output" --> LGSERV

    %% Node → Little-Canary Flask
    PROXY -- "POST /check\nLittle-Canary scan" --> FLASK

    %% Flask → Ollama (canary probe)
    LC -- "POST /api/chat\ncanary LLM probe" --> OLL
```

---

## Traffic Routing

| Traffic | Route |
| :--- | :--- |
| AIRS-Inlet / AIRS-Dual scans | Browser → Node Proxy `:3080/api/prisma` → Prisma AIRS API (cloud) |
| LLM-Guard input scan | Browser → Node Proxy `:3080/api/llmguard-input` → Flask sidecar `:5002/scan/input` |
| LLM-Guard output scan | Browser → Node Proxy `:3080/api/llmguard-output` → Flask sidecar `:5002/scan/output` |
| Little-Canary scan | Browser → Node Proxy `:3080/api/canary` → Flask sidecar `:5001/check` → Ollama |
| LLM inference | Browser → Local Ollama API `:11434` (direct, streaming) |
| Credential config | Browser → `GET /api/config` → `{ hasApiKey, profile }` (key never returned) |

---

## Node Proxy Design Notes

The Node.js proxy (`src/server.js`) exists for two reasons:

1. **CORS bypass** — Browsers block direct `fetch()` calls to Prisma AIRS and to the local Flask sidecars because they don't emit `Access-Control-Allow-Origin` headers. The Node proxy makes those requests server-side where CORS doesn't apply.

2. **Credential isolation** — `AIRS_API_KEY` is loaded from `.env` at startup and attached to outbound requests by the proxy. The browser never receives the key — only a boolean `hasApiKey` flag from `/api/config`.

**Key design point:** The browser talks **directly** to Ollama for all LLM inference (Semantic-Guard judge calls and chat streaming) but routes through the Node proxy for AIRS, LLM Guard, and Little-Canary. Direct Ollama access avoids double-buffering the streaming response; the proxy exists only to bypass CORS for cloud API calls and to keep the AIRS API key off the client.

Ollama requires `OLLAMA_ORIGINS=*` to accept requests from the browser. See the Quick Start in README.md.
