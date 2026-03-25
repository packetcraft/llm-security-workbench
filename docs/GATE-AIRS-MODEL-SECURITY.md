# AIRS Model Security — Technical Reference

> **Scope:** Complete technical reference for the 🔍 Model Security scanner in this workbench. Covers what it scans, the AIRS API, request/response schema, UI integration, and operational guidance.
> For runtime prompt/response security, see **[`docs/GATE-AIRS.md`](GATE-AIRS.md)**.
> For setup instructions, see **[`docs/SETUP-GUIDE-FULL.md`](SETUP-GUIDE-FULL.md)**.

---

## What Model Security Is

**AIRS Model Security** scans AI model artifacts — weights, tokenizer files, config files, and other components — for supply-chain threats before or after deployment. This is a fundamentally different threat surface from runtime security:

| | Runtime Security (AIRS-Inlet / AIRS-Dual) | Model Security |
| :--- | :--- | :--- |
| **What is scanned** | Prompts and responses at inference time | Model files and artifacts |
| **When it runs** | Every chat turn | On-demand, pre/post-deployment |
| **Threat category** | Prompt injection, DLP, jailbreak, policy violation | Malicious code, backdoors, supply-chain tampering |
| **Trigger** | Automatic per-message | Manual — user initiates a scan |
| **Latency** | ~200–800 ms | Seconds to minutes (depends on model size) |

### What it detects

- **Malicious code injection** — executable payloads embedded in model files (pickle exploits, `__reduce__` overrides, deserialization bombs)
- **Backdoors and trojans** — hidden behaviours triggered by specific inputs
- **Supply-chain tampering** — weights or configs modified after original publication
- **Policy violations** — violations of configured security rules across the model artifact set
- **Unsafe serialisation formats** — formats known to allow arbitrary code execution on load

---

## Architecture

```
Browser (8b UI — Model Security pane)
    │  POST /api/model-scan  { model_id, source }
    ▼
src/server.js  :3080
    │  forwards to AIRS Model Security API
    ▼
AIRS Model Security API
    POST https://api.aisecurity.paloaltonetworks.com/v1/aiml/model/scan
    │
    │  AIRS pulls model artifacts from HuggingFace Hub and scans them
    │  against the configured security policy set
    ▼
Response: { scan_id, action, passed_rules, failed_rules, violations[], ... }
    ▼
server.js returns result to browser
    ▼
8b UI: status pill + metrics + violations list + raw JSON
```

**No Python sidecar required.** Model Security calls the AIRS cloud API directly via the Node proxy — the same credential path (`AIRS_API_KEY` in `.env`) as AIRS-Inlet and AIRS-Dual.

---

## API Reference

### Endpoint

```
POST https://api.aisecurity.paloaltonetworks.com/v1/aiml/model/scan
```

> **Note:** Verify the current path at [pan.dev/airs](https://pan.dev/airs). The Palo Alto AIRS API surface evolves; the endpoint above reflects the known path at time of writing. The raw JSON panel in the UI will show the actual response — use it to confirm the endpoint is correct and to inspect the response schema.

### Authentication

Uses the same `x-pan-token` header as all other AIRS gates:

```
x-pan-token: <AIRS_API_KEY>
```

The Node proxy reads `AIRS_API_KEY` from `.env` server-side and injects it — the key is never sent to the browser.

### Request body

```json
{
  "model_id": "google/flan-t5-small",
  "source":   "huggingface"
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `model_id` | string | HuggingFace repository ID in `owner/model-name` format |
| `source` | string | Model source — `"huggingface"` for HuggingFace Hub |

### Response schema

The response structure follows the AIRS scan response pattern. Fields observed from the sandbox demo:

```json
{
  "scan_id":         "ms-<uuid>",
  "action":          "block",
  "passed_rules":    23,
  "failed_rules":    7,
  "violations": [
    {
      "rule_name":   "No pickle serialisation",
      "severity":    "HIGH",
      "description": "Model uses unsafe pickle format with __reduce__ override"
    }
  ],
  "scanner_version": "1.2.0",
  "created":         "2026-03-25T10:42:00Z",
  "files_scanned":   12,
  "files_skipped":   2,
  "tsg_id":          "<tenant-id>",
  "security_group":  "default"
}
```

| Field | Description |
| :--- | :--- |
| `scan_id` | Unique identifier for this scan — use for audit trail lookup in Strata Cloud Manager |
| `action` | `"block"` if violations found, `"allow"` if clean |
| `passed_rules` | Count of security rules that passed |
| `failed_rules` | Count of security rules that failed (violations) |
| `violations[]` | Array of rule violation objects — `rule_name`, `severity`, `description` |
| `scanner_version` | Version of the AIRS model scanning engine |
| `created` | ISO 8601 timestamp of the scan |
| `files_scanned` | Number of model artifact files inspected |
| `files_skipped` | Files AIRS could not scan (unsupported format or corrupt) |
| `tsg_id` | Tenant Security Group ID — ties this scan to your AIRS tenant |

> **Schema note:** The exact field names may vary depending on the API version. The Raw Response panel in the UI always shows the full unmodified JSON — use it to map actual field names if the UI metrics do not populate.

---

## UI Integration

Model Security is a standalone panel accessed via the **🔍** icon in the left rail — it is not part of the chat message pipeline and does not block or flag individual prompts.

### Panel layout

```
🔍 Model Security (nav panel title)
│
├── Description
├── Quick Select — two pre-configured model cards
│     ├── google/flan-t5-small        [✓ Safe]
│     └── opendiffusion/sentimentcheck [⚠ Malicious]
│
├── HuggingFace Model ID — free text input + Scan button
│
├── [on scan complete]
│     ├── Status pill — ✅ Passed or ⛔ Violations found · Xs
│     ├── Metrics row — Passed / Failed / Pass Rate
│     ├── Metadata — Scan ID · Created · Scanner version · Files
│     ├── Violations list — one item per failed rule (name, severity, description)
│     └── Raw Response — full AIRS JSON for debugging
```

### Pre-configured model cards

Two models are hard-coded as quick-select shortcuts, taken from the official AIRS sandbox demo:

| Model | Expected result | Purpose |
| :--- | :--- | :--- |
| `google/flan-t5-small` | ✅ Clean — no violations | Baseline test — confirms the scanner is working and can pass a known-good model |
| `opendiffusion/sentimentcheck` | ⛔ Malicious — violations found | Positive test — confirms the scanner correctly identifies a known-malicious model |

Clicking a card populates the input field and selects the card. The Scan button must be clicked to run.

### Status pill

| State | Condition |
| :--- | :--- |
| `✅ Passed · Xs` | `failed_rules === 0` and `violations.length === 0` and `action !== "block"` |
| `⛔ Violations found · Xs` | Any of: `failed_rules > 0`, `violations.length > 0`, `action === "block"` |
| `Error N — <message>` | Non-2xx HTTP response from the API |
| `Failed — <message>` | Network error or proxy unreachable |

### Raw Response panel

Always shown after a scan attempt — whether success or error. Displays the full unmodified JSON returned by the AIRS API (or the proxy error object). This is the primary debugging surface:

- If the endpoint is wrong, you will see a 404 or 401 response
- If the request body schema is wrong, you will see a 400 with an AIRS error message
- If the scan completes but UI metrics are empty, compare the actual field names against the ones the UI expects

---

## Node Proxy Route

```javascript
// src/server.js
app.post("/api/model-scan", async (req, res) => {
  const modelScanEndpoint =
    "https://api.aisecurity.paloaltonetworks.com/v1/aiml/model/scan";
  const apiKey = process.env.AIRS_API_KEY || req.headers["x-pan-token"];
  // ... forwards req.body with x-pan-token header
});
```

The proxy follows the same pattern as `/api/prisma`: credential injection server-side, full response forwarded to browser, HTTP status code preserved.

---

## Requirements & Setup

### Prerequisites

- **AIRS API key** (`AIRS_API_KEY` in `.env`) — same key used for runtime security gates
- **Model Security entitlement** — the AIRS account must have Model Security scanning enabled. This is a separate product feature from runtime security. If you receive a `403 Forbidden` or a feature-unavailable error, the account may not have this entitlement. Contact your Palo Alto Networks representative or check your Prisma Cloud / AIRS subscription.
- **`npm start`** — the Node proxy must be running (`:3080`)

No Python sidecar, no Ollama model, no additional install required.

### Verify setup

1. Set `AIRS_API_KEY` in `.env` and restart `npm start`
2. Open `http://localhost:3080/dev/8b`
3. Click the 🔍 icon in the left rail
4. Click `google/flan-t5-small` → **Scan**
5. The Raw Response panel shows the API response — check the status code and JSON

If you see `401 Unauthorized`: API key is missing or invalid.
If you see `403 Forbidden`: Model Security entitlement may not be enabled on this account.
If you see `404 Not Found`: The endpoint path may have changed — check pan.dev for the current path.

---

## Model Security vs Runtime Security

| Dimension | Runtime Security | Model Security |
| :--- | :--- | :--- |
| **Pipeline position** | Gates 1 and 6 (AIRS-Inlet, AIRS-Dual) | Standalone panel — not in the chat pipeline |
| **Scans** | User prompts + LLM responses | Model weights and artifact files |
| **Frequency** | Every message automatically | On-demand |
| **Blocking** | Can block individual chat turns | Reports findings — does not block chat |
| **Threat surface** | Adversarial inputs (injection, DLP, jailbreak) | Supply-chain (malicious code, tampering) |
| **Requires Ollama** | No | No |
| **Requires sidecar** | No (AIRS is cloud-only) | No |
| **Latency** | 200–800 ms | Seconds to minutes |

**Use both.** Runtime security protects the live conversation. Model security protects the model itself before it is used. A model that passes the supply-chain scan can still generate harmful content — and a clean model can still be attacked via adversarial prompts. They are complementary, not redundant.

---

## Limitations

- **HuggingFace only (current UI).** The workbench UI supports HuggingFace Hub scanning only. Local file upload (the second tab in the AIRS sandbox) is not implemented — this avoids the complexity of multipart form data handling in the proxy.
- **Scan time.** Large models (>1 GB of weights) may take minutes to scan. The UI shows a spinner but does not stream progress.
- **Entitlement dependency.** Model Security is a separate AIRS product feature. If the account does not have it enabled, all scans will return an error.
- **Endpoint stability.** The AIRS API surface evolves. If the endpoint moves, update the URL constant in `server.js` route `/api/model-scan`.
- **No caching.** The same model will be re-scanned on every button click. AIRS may cache results server-side for recent scans.
- **No pipeline integration.** Model Security results do not flow into the API Inspector, Live Telemetry, or Red Teaming panels — it is a standalone tool.
