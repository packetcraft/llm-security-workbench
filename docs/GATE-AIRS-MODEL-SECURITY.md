# AIRS Model Security — Technical Reference

> **Scope:** Complete technical reference for the 🔍 Model Security scanner in this workbench. Covers the SDK-based sidecar architecture, private PyPI bootstrap, credentials, request/response schema, and UI integration.
> For runtime prompt/response security, see **[`docs/GATE-AIRS.md`](GATE-AIRS.md)**.
> For setup instructions, see **[`docs/SETUP-GUIDE-FULL.md`](SETUP-GUIDE-FULL.md)**.

---

## What Model Security Is

**AIRS Model Security** scans AI model artifacts — weights, tokenizer files, config files — for supply-chain threats *before or after deployment*. This is a different threat surface from runtime security:

| | Runtime Security (AIRS-Inlet / AIRS-Dual) | Model Security |
| :--- | :--- | :--- |
| **What is scanned** | Prompts and responses at inference time | Model files and artifacts |
| **When it runs** | Every chat turn (automatic) | On-demand |
| **Threat category** | Prompt injection, DLP, jailbreak | Malicious code, backdoors, supply-chain tampering |
| **Credentials** | `AIRS_API_KEY` | OAuth2 client credentials (separate) |
| **Sidecar port** | None | `:5004` |

### What it detects

- **Malicious code injection** — pickle exploits, `__reduce__` overrides, deserialization bombs embedded in model files
- **Backdoors and trojans** — hidden behaviours triggered by specific inputs at inference time
- **Supply-chain tampering** — weights or configs modified after original publication
- **Policy violations** — violations of security rules configured in the AIRS console
- **Unsafe serialisation formats** — formats known to allow arbitrary code execution on model load

---

## Architecture

```
Browser (8b UI — Model Security pane)
    │  POST /api/model-scan  { model_id: "google/flan-t5-small" }
    ▼
src/server.js  :3080
    │  forwards to http://localhost:5004/scan/hf
    ▼
services/airs-model-scan/model_scan_server.py  :5004
    │  normalises model_id → https://huggingface.co/google/flan-t5-small
    │  calls ModelSecurityAPIClient.scan(security_group_uuid, model_uri)
    ▼
model-security-client SDK  (private PyPI package)
    │  OAuth2 client_credentials → access token
    │  POST https://api.sase.paloaltonetworks.com/aims  (model scan API)
    ▼
Result: { eval_outcome, ... } — Pydantic v2 model, serialised as JSON
    ▼
server.js returns result to browser
    ▼
8b UI: status pill + metrics + violations list + raw JSON
```

**This gate uses its own Python sidecar** — like LLM-Guard and Little-Canary, it must be running before scans will work. The sidecar wraps the private `model-security-client` SDK which handles OAuth2 token acquisition internally.

---

## Setup

### Step 1 — Get credentials

Model Security uses **OAuth2 client credentials** — separate from the `AIRS_API_KEY` used for runtime security. Obtain from the Palo Alto AI Model Security console:

| Credential | Where to find it |
| :--- | :--- |
| `MODEL_SECURITY_CLIENT_ID` | Prisma Cloud → AI Model Security → API Credentials |
| `MODEL_SECURITY_CLIENT_SECRET` | Same — shown once at creation |
| `TSG_ID` | Tenant Service Group ID — visible in the console URL or tenant settings |
| `SECURITY_GROUP_UUID_HF` | AI Model Security → Security Groups → your HuggingFace group UUID |

Add all four to your `.env`:

```env
MODEL_SECURITY_CLIENT_ID=your-client-id
MODEL_SECURITY_CLIENT_SECRET=your-client-secret
TSG_ID=your-tsg-id
SECURITY_GROUP_UUID_HF=your-hf-security-group-uuid
MODEL_SECURITY_API_ENDPOINT=https://api.sase.paloaltonetworks.com/aims
```

### Step 2 — Bootstrap private PyPI and install the SDK

The `model-security-client` package is **not on public PyPI**. It lives on an authenticated private index. The bootstrap requires your credentials from Step 1.

**Get an OAuth2 access token:**
```bash
SCM_TOKEN=$(curl -s -X POST "https://auth.apps.paloaltonetworks.com/oauth2/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "$MODEL_SECURITY_CLIENT_ID:$MODEL_SECURITY_CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=tsg_id:$TSG_ID" \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

**Get the private PyPI URL:**
```bash
PYPI_URL=$(curl -s -X GET "https://api.sase.paloaltonetworks.com/aims/mgmt/v1/pypi/authenticate" \
  -H "Authorization: Bearer $SCM_TOKEN" \
  | python -c "import sys,json; print(json.load(sys.stdin)['url'])")
```

**Create the venv and install:**
```bash
# Windows
py -3.12 -m venv services/airs-model-scan/.venv
services\airs-model-scan\.venv\Scripts\pip install flask python-dotenv
services\airs-model-scan\.venv\Scripts\pip install model-security-client --extra-index-url %PYPI_URL%

# macOS / Linux
python3.12 -m venv services/airs-model-scan/.venv
services/airs-model-scan/.venv/bin/pip install flask python-dotenv
services/airs-model-scan/.venv/bin/pip install model-security-client --extra-index-url $PYPI_URL
```

> **Python version:** 3.12 required — the same as LLM-Guard. Do not use 3.13 or 3.14.

### Step 3 — Start the sidecar

```bash
npm run model-scan
```

Verify it is running:
```bash
curl http://localhost:5004/health
# → { "status": "ok", "service": "airs-model-scan", "sdk_available": true }
```

The 🔍 icon in the 8b nav panel shows a **green dot** when the sidecar is online with the SDK loaded, and a **grey dot** when it is offline or the SDK is not installed.

---

## SDK Reference

### Package

```
model-security-client   (private PyPI — see bootstrap above)
```

### Client construction

```python
from model_security_client.api import ModelSecurityAPIClient

client = ModelSecurityAPIClient(
    base_url="https://api.sase.paloaltonetworks.com/aims"
)
```

The client reads `MODEL_SECURITY_CLIENT_ID`, `MODEL_SECURITY_CLIENT_SECRET`, and `TSG_ID` from the environment automatically after `load_dotenv()`. No credentials are passed to the constructor.

### Scan a HuggingFace model

```python
result = client.scan(
    security_group_uuid="<SECURITY_GROUP_UUID_HF>",
    model_uri="https://huggingface.co/google/flan-t5-small"
)
```

### Response

The result is a **Pydantic v2 model**. Key fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `eval_outcome` | str | Top-level verdict — e.g. `"SAFE"`, `"UNSAFE"` |
| *(full schema)* | — | Use `result.model_dump_json(indent=2)` to see all fields — the full schema is defined inside the private package |

The sidecar returns `json.loads(result.model_dump_json())` — the complete Pydantic model as a plain JSON dict.

---

## Sidecar API

**File:** `services/airs-model-scan/model_scan_server.py`
**Port:** `5004`

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/health` | GET | Returns `{ status, service, sdk_available, sdk_error }` |
| `/scan/hf` | POST | Scans a HuggingFace model |

**`POST /scan/hf` — request:**
```json
{ "model_id": "google/flan-t5-small" }
```
or equivalently:
```json
{ "model_uri": "https://huggingface.co/google/flan-t5-small" }
```

Both forms are accepted. `model_id` (bare `author/model-name`) is normalised to a full URL internally.

**`POST /scan/hf` — response:**
```json
{
  "eval_outcome": "SAFE",
  ...
}
```

---

## Node Proxy Routes

| Route | Description |
| :--- | :--- |
| `GET /api/model-scan/health` | Proxies to `:5004/health` — used by the UI status dot |
| `POST /api/model-scan` | Proxies to `:5004/scan/hf` — used by the Scan button |

Both routes are in `src/server.js`. If the sidecar is not running, the proxy returns `502` with a message telling you to run `npm run model-scan`.

---

## Pre-configured Model Cards

Two models are hardcoded in the UI as quick-select shortcuts:

| Model | Expected verdict | Purpose |
| :--- | :--- | :--- |
| `google/flan-t5-small` | ✅ SAFE | Baseline test — confirms scanner is working on a known-clean model |
| `opendiffusion/sentimentcheck` | ⚠ Malicious | Positive test — confirms scanner correctly flags a known-malicious model |

---

## Model Security vs Runtime Security

| Dimension | Runtime Security | Model Security |
| :--- | :--- | :--- |
| Pipeline position | Gates 1 and 6 | Standalone panel — not in the chat pipeline |
| Credentials | `AIRS_API_KEY` (x-pan-token) | OAuth2 client credentials |
| Sidecar | None | `:5004` (Python SDK wrapper) |
| Scans | Prompts + responses | Model artifacts |
| Frequency | Every message automatically | On-demand |
| Blocking | Blocks individual chat turns | Reports only — does not block chat |

---

## Limitations

- **HuggingFace only.** The workbench UI supports HuggingFace Hub scanning only. Local file path scanning is implemented in the sidecar (`/scan/local` not yet wired to the UI).
- **Private PyPI.** The `model-security-client` package requires the three-step bootstrap above. The sidecar will start without it but every scan will return a `503` with the install instructions.
- **Separate entitlement.** Model Security is a separate AIRS product. If your account does not have it, the OAuth2 token request or the scan call will return an auth or entitlement error.
- **Scan latency.** Model scanning is not real-time — large models (>1 GB) may take minutes. The UI shows a spinner but does not stream progress.
- **No pipeline integration.** Model Security results do not appear in the API Inspector, Live Telemetry, or Red Teaming panels.
