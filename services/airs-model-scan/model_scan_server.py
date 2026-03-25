"""
AIRS Model Security sidecar — Flask REST wrapper around the model-security-client SDK.
Port: 5004

Requires:
  model-security-client (private PyPI — see docs/GATE-AIRS-MODEL-SECURITY.md for install)
  flask>=3.0.0
  python-dotenv>=1.0.0

Environment variables (from .env):
  MODEL_SECURITY_CLIENT_ID      — OAuth2 client ID
  MODEL_SECURITY_CLIENT_SECRET  — OAuth2 client secret
  TSG_ID                        — Tenant Service Group ID
  SECURITY_GROUP_UUID_HF        — Security group UUID for HuggingFace scans
  MODEL_SECURITY_API_ENDPOINT   — API base URL (default: https://api.sase.paloaltonetworks.com/aims)
"""

import os
import json
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()

# ── SDK import with graceful fallback ────────────────────────────────────────
try:
    from model_security_client.api import ModelSecurityAPIClient
    SDK_AVAILABLE = True
    SDK_ERROR = None
except ImportError as e:
    SDK_AVAILABLE = False
    SDK_ERROR = (
        "model-security-client not installed. "
        "This package is on a private PyPI index — see docs/GATE-AIRS-MODEL-SECURITY.md "
        f"for the install steps. ImportError: {e}"
    )

# ── Config ───────────────────────────────────────────────────────────────────
HF_UUID  = os.getenv("SECURITY_GROUP_UUID_HF")
BASE_URL = os.getenv("MODEL_SECURITY_API_ENDPOINT",
                     "https://api.sase.paloaltonetworks.com/aims")

HUGGINGFACE_BASE = "https://huggingface.co"

app = Flask(__name__)

# Build SDK client once (credentials loaded from env by the SDK itself)
_client = None

def get_client():
    global _client
    if _client is None:
        _client = ModelSecurityAPIClient(base_url=BASE_URL)
    return _client


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":        "ok",
        "service":       "airs-model-scan",
        "sdk_available": SDK_AVAILABLE,
        "sdk_error":     SDK_ERROR,
    })


@app.route("/scan/hf", methods=["POST"])
def scan_hf():
    """
    Scan a HuggingFace model.
    Body: { "model_id": "google/flan-t5-small" }
          OR { "model_uri": "https://huggingface.co/google/flan-t5-small" }
    Returns: full AIRS scan result JSON
    """
    if not SDK_AVAILABLE:
        return jsonify({"error": SDK_ERROR}), 503

    if not HF_UUID:
        return jsonify({"error": "SECURITY_GROUP_UUID_HF not set in .env"}), 500

    data = request.get_json(force=True) or {}

    # Accept either a bare model_id or a full model_uri
    model_uri = data.get("model_uri") or data.get("model_id")
    if not model_uri:
        return jsonify({"error": "model_id or model_uri is required"}), 400

    # Normalise to full URL if only author/model-name was given
    if not model_uri.startswith("http"):
        model_uri = f"{HUGGINGFACE_BASE}/{model_uri}"

    try:
        result = get_client().scan(
            security_group_uuid=HF_UUID,
            model_uri=model_uri,
        )
        return jsonify(json.loads(result.model_dump_json()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    if not SDK_AVAILABLE:
        print(f"⚠️  WARNING: {SDK_ERROR}")
        print("   The /health endpoint will still respond but /scan/hf will return 503.")
    print(f"🔍 AIRS Model Security sidecar running on http://localhost:5004")
    print(f"   Base URL : {BASE_URL}")
    print(f"   HF UUID  : {HF_UUID or '(not set)'}")
    app.run(host="0.0.0.0", port=5004, debug=False)
