<!--
  WHAT THIS FILE HOLDS:
  Technical deep-dive on dev/7a-airs-sdk.html — the AIRS Python SDK evaluation build.
  Documents every 7a-specific addition: new functions, design decisions, data flows,
  trade-offs, and known optimisation opportunities.

  PRIMARY AUDIENCE:
  A future Claude Code session running a code optimisation pass on dev/7a-airs-sdk.html.
  Read this before touching the file.

  CROSS-REFERENCES:
  - docs/ARCHITECTURE.md    — component diagram, traffic routing, UI layout
  - docs/5-SETUP-GUIDE.md   — how to install and start every sidecar
  - docs/SECURITY-GATES.md  — per-gate logic and configuration
  - docs/DYNAMIC-PROBE.md   — Dynamic Probe (PAIR) architecture (inherited from 6b)
-->

# dev/7a-airs-sdk — Technical Reference

## What 7a Is

`dev/7a-airs-sdk.html` is a direct copy of `dev/6b-dynamic-redteam.html` with three additions:

1. **Sidecar status dots** — a coloured dot in every gate's header row showing live service health
2. **AIRS Python SDK sidecar** (`services/airs-sdk/airs_sdk_server.py`, port `:5003`) — wraps `pan-aisecurity` to expose batch scanning
3. **Batch pre-scan cache** — before the batch loop runs, all prompts are sent to the SDK sidecar 5-at-a-time; results are cached and the loop reads from cache instead of making per-threat REST calls

**Everything inherited from 6b is unchanged.** The six-gate chat pipeline, Dynamic Probe (PAIR), batch runner logic, export functions, telemetry panel, API Inspector, Red Teaming drawer — all identical to 6b.

---

## New Files (7a only)

| File | Port | Purpose |
| :--- | :--- | :--- |
| `services/airs-sdk/airs_sdk_server.py` | `:5003` | Flask sidecar wrapping `pan-aisecurity` SDK |
| `services/airs-sdk/requirements.txt` | — | `flask`, `pan-aisecurity` |

### Node proxy additions (`src/server.js`)

Three new routes added after the existing `/api/prisma` route:

| Route | Forwards to | Purpose |
| :--- | :--- | :--- |
| `GET /api/canary/health` | `:5001/health` | Little-Canary status dot |
| `GET /api/llmguard/health` | `:5002/health` | LLM-Guard status dot |
| `GET /api/airs-sdk/health` | `:5003/health` | AIRS SDK dot + pre-scan gate |
| `POST /api/airs-sdk/sync` | `:5003/scan/sync` | Single SDK scan (future use) |
| `POST /api/airs-sdk/batch` | `:5003/scan/batch` | Batch pre-scan (batch runner) |

The Node proxy injects `AIRS_API_KEY` from `.env` into the body before forwarding to the sidecar. The browser never sends the key directly to port 5003.

---

## Function Map — 7a Additions Only

All line numbers are approximate (±5 lines) and refer to `dev/7a-airs-sdk.html`.

| Function | Line | Type | Purpose |
| :--- | :--- | :--- | :--- |
| `setSidecarDot(id, online, title)` | ~5509 | sync | Updates a status dot's background colour and tooltip title |
| `checkSidecarHealth()` | ~5516 | async | Polls all four service health endpoints on page load; updates all dots |
| `startBatchRun()` | ~5561 | async | Inherited from 6b — **modified**: pre-scan cache block inserted before main loop |

`setSidecarDot` and `checkSidecarHealth` are entirely new. `startBatchRun` is 6b code with one block added (~lines 5619–5655).

### Key inherited functions (not modified, for context)

| Function | Line | Purpose |
| :--- | :--- | :--- |
| `scanWithAIRS(contentObj, phase, mode, profile, apiKey, modelName)` | ~4233 | Per-call REST scan — used as fallback in batch loop and in chat pipeline |
| `getSelectedThreats()` | ~5485 | Returns array of selected threat objects for the batch runner |
| `startPairRun()` | ~6317 | Dynamic Probe (PAIR) — unchanged from 6b |
| `runLLMGuard / runLittleCanary / runNativeGuardrail` | 4077 / 4169 / 4189 | Gate helper functions — unchanged |

---

## Sidecar — `airs_sdk_server.py`

### SDK import chain

```python
import aisecurity                                                    # global init
from aisecurity.generated_openapi_client.models.ai_profile import AiProfile
from aisecurity.scan.inline.scanner import Scanner                  # sync (non-asyncio)
from aisecurity.scan.models.content import Content
```

The package name on PyPI is `pan-aisecurity`; the importable name is `aisecurity`.

### Global state

```python
SDK_AVAILABLE = False   # set to True if import succeeds
SDK_ERROR = None        # import error string if SDK not installed
_init_lock = threading.Lock()   # protects aisecurity.init() global config setter
```

`aisecurity.init(api_key=...)` is a **global setter** — it sets process-wide config. All threads share it. The lock ensures no thread reads a half-written config during init.

### `response_to_dict(resp)` — serialisation fallback chain

```python
def response_to_dict(resp) -> dict:
    if hasattr(resp, "to_dict"):    return resp.to_dict()    # OpenAPI-generated client
    if hasattr(resp, "model_dump"): return resp.model_dump() # Pydantic v2
    return vars(resp)                                         # plain object fallback
```

The SDK uses an OpenAPI-generated client, so `to_dict()` is the active path. The other branches are defensive fallbacks.

### `/scan/batch` — threading model

```
POST /scan/batch  { api_key, profile, prompts: ["p1", "p2", ...] }
│
├── aisecurity.init(api_key)      ← one call, under _init_lock, before threads start
│
└── ThreadPoolExecutor(max_workers=5)
    ├── Thread 1: Scanner().sync_scan(AiProfile, Content("p1"))
    ├── Thread 2: Scanner().sync_scan(AiProfile, Content("p2"))
    ├── Thread 3: Scanner().sync_scan(AiProfile, Content("p3"))
    ├── Thread 4: Scanner().sync_scan(AiProfile, Content("p4"))
    └── Thread 5: Scanner().sync_scan(AiProfile, Content("p5"))
    ... (remaining prompts queue behind the 5 workers)
```

Each thread creates its **own** `Scanner()` instance — Scanner is not thread-safe for concurrent use but is cheap to instantiate. `aisecurity.init()` is called once before the pool to set global config; threads read it concurrently (safe for reads).

### `/scan/batch` response format

The endpoint returns a JSON array, length == `len(prompts)`, preserving input order:

```json
[
  {
    "action": "block" | "allow",
    "category": "malicious" | "benign" | "...",
    "scan_id": "uuid",
    "report_id": "uuid",
    "prompt_detected": {
      "url_cats": false,
      "dlp": false,
      "injection": true,
      "malicious_code": false,
      "toxic_content": false,
      "ip_reputation": false,
      "malware": false
    },
    "response_detected": { ... }
  },
  { "error": "..." }   ← per-item error if that scan failed
]
```

`null` entries are not possible — each slot is either a result dict or `{ "error": "..." }`.

---

## Browser — Sidecar Status Dots

### DOM elements

Four `<span class="sidecar-dot" id="sc-*">` elements in the Security Pipeline sidebar, one per gate header row:

| HTML id | Gate | Service checked |
| :--- | :--- | :--- |
| `sc-llmguard` | 🔬 LLM-Guard | `GET /api/llmguard/health` → `:5002/health` |
| `sc-semantic` | 🧩 Semantic-Guard | `GET http://localhost:11434/api/tags` (direct, browser→Ollama) |
| `sc-canary` | 🐦 Little-Canary | `GET /api/canary/health` → `:5001/health` |
| `sc-airs` | 🔀 AIRS (In/Out) | `GET /api/airs-sdk/health` → `:5003/health` |

### CSS class `.sidecar-dot`

```css
.sidecar-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--muted, #444);   /* grey = offline */
    flex-shrink: 0;
    transition: background 0.3s;
    cursor: help;
    pointer-events: auto;
}
```

Online colour: `#00ff88` (set via `el.style.background` in `setSidecarDot`).

### `checkSidecarHealth()` — call order

The four checks run **sequentially** (not in parallel) — each `await fetch(...)` resolves before the next starts. This is intentional (avoids flooding on page load) but is an optimisation candidate if startup time matters.

### `sc-airs` dot — dynamic updates during batch run

The AIRS dot is the only one that updates after initial page load. Its `title` progresses through three states during a batch run:

1. **"AIRS SDK sidecar: online — batch pre-scan active (5 parallel)"** — initial health check
2. **"AIRS SDK: pre-scanning N prompts…"** — pre-scan in progress
3. **"AIRS SDK: N/N pre-scanned — inline cache active"** — pre-scan complete

---

## Browser — Batch Pre-Scan Cache

### Location in `startBatchRun()`

The cache block sits between the "disable start button / enable stop button" setup and the main `for` loop over threats.

```
startBatchRun()
  ├── snapshot gate modes
  ├── check at least one gate is active
  ├── resolve phase configs (guardModel, canaryModel, airsProfile, etc.)
  ├── disable start btn, enable stop btn
  ├── ── AIRS SDK PRE-SCAN CACHE (7a addition) ──────────────────────
  │   if phase1Active:
  │     fetch /api/airs-sdk/health
  │     if sdk_available:
  │       setSidecarDot("sc-airs", "pre-scanning N…")
  │       POST /api/airs-sdk/batch { profile, prompts: allThreats.map(t=>t.example) }
  │       build _airsCache: Map<prompt_text → raw_sdk_response>
  │       setSidecarDot("sc-airs", "N/N pre-scanned")
  │     else: setSidecarDot offline, _airsCache stays empty (REST fallback)
  │   on error: setSidecarDot offline, _airsCache stays empty
  ├── ── MAIN LOOP ────────────────────────────────────────────────────
  │   for each threat:
  │     Phase 0.6: LLM-Guard
  │     Phase 0:   Semantic-Guard
  │     Phase 0.5: Little-Canary
  │     Phase 1:   AIRS-Inlet  ← checks _airsCache first, REST fallback on miss
  │     LLM generation
  │     Phase 2:   AIRS-Dual   ← always REST (scans LLM response, not pre-scannable)
  │     Phase 2.5: LLM-Guard output
  └── render summary, re-enable start btn
```

### Cache lookup — AIRS-Inlet block

```javascript
const cached = _airsCache.get(threat.example);
let s;
if (cached) {
    // reconstruct the same shape scanWithAIRS() returns
    const isBlock = cached.action === "block";
    const detected = Object.entries(cached.prompt_detected || {})
        .filter(([, v]) => v === true).map(([k]) => k);
    s = {
        status: isBlock ? (airsMode === "strict" ? "block" : "alert") : "allow",
        action: cached.action || "allow",
        category: cached.category || "benign",
        detected,
        scanId: cached.scan_id || null,
        raw_response: cached,
    };
} else {
    // sidecar offline or prompt not in cache → original REST path
    s = await scanWithAIRS({ prompt: threat.example }, "prompt",
        airsMode, airsProfile, airsApiKey, modelSelect);
}
// rest of existing AIRS-Inlet handling (identical for cached and REST paths)
```

`scanWithAIRS()` returns `{ status, action, category, detected, maskedData, scanId, reportId, raw_response }`. The cache reconstruction matches this shape exactly except `maskedData` and `reportId` (not needed for batch runner display).

---

## Design Decisions and Rationale

### Why pre-scan all prompts before the loop (not just AIRS-unblocked ones)

Pre-scanning all prompts lets the batch endpoint fire all AIRS calls in parallel (5 at a time) **before** any threat-level logic runs. If we only pre-scanned threats that passed earlier gates, we'd need to interleave gate checks with SDK calls, losing the parallelism benefit.

Trade-off: some pre-scanned prompts will be blocked by LLM-Guard, Semantic-Guard, or Little-Canary and never reach AIRS-Inlet — those SDK calls were wasted. For a 68-threat library, this is acceptable. For very large threat sets or high AIRS API cost, a two-pass approach (run local gates first, then batch-scan survivors) would be more efficient.

### Why `ThreadPoolExecutor` over `scanner.async_scan()`

The SDK provides a true async batch endpoint (`aisecurity.scan.asyncio.scanner.Scanner.async_scan`) that submits multiple scans and returns a job ID for polling. We chose `ThreadPoolExecutor` with concurrent `sync_scan()` calls instead because:

- No polling loop required — `as_completed()` yields results as they finish
- Simpler error isolation — one failed scan doesn't affect others
- `sync_scan` response is immediate and structured; async polling adds latency and complexity
- Flask is a WSGI (synchronous) server — mixing asyncio inside Flask request handlers is fragile

The async approach could be revisited if the SDK's async backend becomes significantly faster than 5×sync.

### Why each thread gets its own `Scanner()` instance

`Scanner()` is a thin wrapper that uses the global `aisecurity` config for HTTP calls. It is not documented as thread-safe for concurrent `sync_scan()` calls on the same instance. Creating one per thread is the safe default and cheap (no model loading, just an HTTP client wrapper).

### Why `_init_lock` wraps `aisecurity.init()` but not `Scanner()`

`aisecurity.init()` writes to a global config dict. `Scanner()` and `sync_scan()` only read it. The lock is only needed around the write; reads from multiple threads are safe.

### Why the Semantic-Guard dot calls Ollama directly (not through the proxy)

Semantic-Guard calls Ollama directly from the browser (not via Node proxy) — see ARCHITECTURE.md. Adding a proxy health route for Ollama would be inconsistent with that design. The browser already has `OLLAMA_ORIGINS=*` permission to reach `:11434` directly.

### Why sidebar width was increased to 225px

The gate header row is a flex row: `gate-name (flex:1) | sidecar-dot (8px) | mode-badge | chevron`. At 200px, the row was too narrow for some gate names (e.g. "🧩 Semantic-Guard") to display cleanly alongside all elements. 225px gives sufficient room without impacting the main content area noticeably.

---

## Known Trade-offs and Optimisation Opportunities

### 1 — Sequential health checks on page load

`checkSidecarHealth()` awaits four fetches sequentially. If sidecars are slow to respond (especially Ollama with large model lists), startup takes longer than necessary.

**Optimisation:** Run all four in parallel with `Promise.all()` or `Promise.allSettled()`:
```javascript
await Promise.allSettled([
    checkOllama(),
    checkLLMGuard(),
    checkCanary(),
    checkAIRSSDK(),
]);
```
This requires splitting `checkSidecarHealth()` into per-service helpers.

### 2 — Pre-scan includes threats that will be blocked upstream

All threats are pre-scanned through AIRS SDK even if they'd be caught by LLM-Guard or Semantic-Guard first. For the 68-threat library this is ~5–15 wasted calls. For larger libraries or expensive AIRS profiles, this matters.

**Optimisation:** Two-pass strategy — run local gates (LLM-Guard, Semantic-Guard, Little-Canary) in a first pass, collect survivors, batch-SDK-scan survivors, then run full loop. Adds complexity but minimises API usage.

### 3 — `_airsCache` is prompt-text keyed, not threat-ID keyed

If two threats have the same example text (unlikely but possible after deduplication), they share a cache entry. This is correct behaviour (same prompt → same scan result) but worth being aware of.

### 4 — `response_to_dict()` fallback chain is defensive but untested beyond `to_dict()`

The `model_dump()` and `vars()` fallbacks have never been exercised — the SDK always returns objects with `to_dict()`. If the SDK upgrades to Pydantic v2 models, `model_dump()` would activate. The fallback chain is correct but could be simplified once the SDK version is locked.

### 5 — `sc-airs` dot title tooltip is the only runtime status indicator

There is no visible text label showing cache status after the batch run completes. The dot's `title` attribute (hover-only) updates to `"N/N pre-scanned — inline cache active"` but this is invisible without hovering.

**Optimisation:** Add a small persistent text counter (e.g. `"SDK: 68 cached"`) next to the dot, or update the progress label area after pre-scan completes.

### 6 — AIRS-Dual response scan is not cached

AIRS-Dual scans the LLM's actual response text — not pre-scannable. It always uses the per-call REST path (`scanWithAIRS()`). This is by design (correct). No optimisation opportunity here.

### 7 — No retry logic in the sidecar

`scan_batch()` propagates individual scan errors as `{"error": "..."}` entries in the results array. There is no retry on transient failures (network blip, AIRS rate limit). The browser skips errored cache entries and falls back to REST for that threat.

**Optimisation:** Add per-scan retry (1–2 attempts, exponential backoff) inside `scan_one()` in the sidecar.

---

## What a Code Optimisation Pass Should Focus On

When running an optimisation routine against `dev/7a-airs-sdk.html`, the 7a-specific code is confined to:

1. **Lines ~2619–2756** — sidecar dot `<span>` elements in gate header HTML
2. **Lines ~1683–1692** — `.sidecar-dot` CSS class
3. **Lines ~5509–5558** — `setSidecarDot()` and `checkSidecarHealth()` functions
4. **Lines ~5619–5655** — AIRS SDK pre-scan block inside `startBatchRun()`
5. **Lines ~5724–5744** — cache lookup in the AIRS-Inlet block inside the batch loop

Everything outside these ranges is 6b code. Optimisations to shared code (e.g. `scanWithAIRS`, `runLLMGuard`, `startPairRun`) should be applied carefully and verified against the 6b baseline.

The sidecar `services/airs-sdk/airs_sdk_server.py` is entirely standalone and can be optimised independently.
