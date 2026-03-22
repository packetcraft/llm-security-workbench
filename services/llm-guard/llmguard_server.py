#!/usr/bin/env python3
"""
LLM Guard sidecar — Phase 0.6 (input) & Phase 2.5 (output)
Runs on port 5002. Called by Node.js proxy via /api/llmguard-input and /api/llmguard-output.

Tier 1 Input Scanners:  InvisibleText, Secrets, PromptInjection, Toxicity, BanTopics, Gibberish, Language
Tier 2 Output Scanners: Sensitive, MaliciousURLs, NoRefusal, Bias, Relevance, LanguageSame

Install:  pip install -r llm-guard/requirements.txt
Run:      python llm-guard/llmguard_server.py
"""

from flask import Flask, request, jsonify
import time

app = Flask(__name__)

# ── Lazy-loaded scanner cache ─────────────────────────────────────────────────
# Models are downloaded from HuggingFace on first use (~2–3 GB total).
# After first load, they stay warm in memory for the lifetime of the process.
_input_cache: dict = {}
_output_cache: dict = {}

INPUT_SCANNER_MAP = {
    "InvisibleText":   lambda: _import("llm_guard.input_scanners", "InvisibleText")(),
    "Secrets":         lambda: _import("llm_guard.input_scanners", "Secrets")(),
    "PromptInjection": lambda: _import("llm_guard.input_scanners", "PromptInjection")(),
    "Toxicity":        lambda: _import("llm_guard.input_scanners", "Toxicity")(),
    "BanTopics":       lambda: _import("llm_guard.input_scanners", "BanTopics")(
                           topics=["violence", "self-harm", "weapons", "illegal drugs",
                                   "terrorism", "child exploitation"]),
    "Gibberish":       lambda: _import("llm_guard.input_scanners", "Gibberish")(),
    "Language":        lambda: _import("llm_guard.input_scanners", "Language")(
                           valid_languages=["en"]),
}

OUTPUT_SCANNER_MAP = {
    "Sensitive":     lambda: _import("llm_guard.output_scanners", "Sensitive")(),
    "MaliciousURLs": lambda: _import("llm_guard.output_scanners", "MaliciousURLs")(),
    "NoRefusal":     lambda: _import("llm_guard.output_scanners", "NoRefusal")(),
    "Bias":          lambda: _import("llm_guard.output_scanners", "Bias")(),
    "Relevance":     lambda: _import("llm_guard.output_scanners", "Relevance")(),
    "LanguageSame":  lambda: _import("llm_guard.output_scanners", "LanguageSame")(),
}

def _import(module: str, cls: str):
    import importlib
    return getattr(importlib.import_module(module), cls)

def _get_input_scanner(name: str):
    if name not in _input_cache:
        factory = INPUT_SCANNER_MAP.get(name)
        if factory is None:
            return None, f"Unknown scanner: {name}"
        try:
            _input_cache[name] = factory()
        except Exception as exc:
            return None, str(exc)
    return _input_cache[name], None

def _get_output_scanner(name: str):
    if name not in _output_cache:
        factory = OUTPUT_SCANNER_MAP.get(name)
        if factory is None:
            return None, f"Unknown scanner: {name}"
        try:
            _output_cache[name] = factory()
        except Exception as exc:
            return None, str(exc)
    return _output_cache[name], None


# ── Health ────────────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":  "ok",
        "service": "llm-guard",
        "loaded_input_scanners":  list(_input_cache.keys()),
        "loaded_output_scanners": list(_output_cache.keys()),
    })


# ── Input scan (Phase 0.6) ────────────────────────────────────────────────────
@app.route("/scan/input", methods=["POST"])
def scan_input():
    body     = request.json or {}
    text     = body.get("text", "")
    scanners = body.get("scanners", list(INPUT_SCANNER_MAP.keys()))

    results:   dict = {}
    is_valid:  bool = True

    for name in scanners:
        scanner, load_err = _get_input_scanner(name)
        if scanner is None:
            results[name] = {"error": load_err or f"Unknown or unsupported scanner: {name}"}
            is_valid = False
            continue
        try:
            t0 = time.time()
            sanitized, valid, risk_score = scanner.scan(text)
            latency_ms = round((time.time() - t0) * 1000)
            results[name] = {
                "valid":      bool(valid),
                "risk_score": float(risk_score) if risk_score is not None else None,
                "sanitized":  sanitized if sanitized != text else None,
                "latency_ms": latency_ms,
            }
            if not valid:
                is_valid = False
        except Exception as exc:
            results[name] = {"error": str(exc)}

    return jsonify({"valid": is_valid, "results": results})


# ── Output scan (Phase 2.5) ───────────────────────────────────────────────────
@app.route("/scan/output", methods=["POST"])
def scan_output():
    body     = request.json or {}
    prompt   = body.get("prompt", "")
    response = body.get("response", "")
    scanners = body.get("scanners", list(OUTPUT_SCANNER_MAP.keys()))

    results:   dict = {}
    is_valid:  bool = True

    for name in scanners:
        scanner, load_err = _get_output_scanner(name)
        if scanner is None:
            results[name] = {"error": load_err or f"Unknown or unsupported scanner: {name}"}
            is_valid = False
            continue
        try:
            t0 = time.time()
            sanitized, valid, risk_score = scanner.scan(prompt, response)
            latency_ms = round((time.time() - t0) * 1000)
            results[name] = {
                "valid":      bool(valid),
                "risk_score": float(risk_score) if risk_score is not None else None,
                "sanitized":  sanitized if sanitized != response else None,
                "latency_ms": latency_ms,
            }
            if not valid:
                is_valid = False
        except Exception as exc:
            results[name] = {"error": str(exc)}

    return jsonify({"valid": is_valid, "results": results})


# ── Warmup — eager-load all scanner models ────────────────────────────────────
def warmup_all():
    """Download and cache every scanner model. Safe to call at startup."""
    total = len(INPUT_SCANNER_MAP) + len(OUTPUT_SCANNER_MAP)
    done  = 0
    print(f"⬇️  Warming up {total} scanner models from HuggingFace …")
    for name in INPUT_SCANNER_MAP:
        print(f"  [{done+1}/{total}] input  · {name} …", flush=True)
        _get_input_scanner(name)
        done += 1
    for name in OUTPUT_SCANNER_MAP:
        print(f"  [{done+1}/{total}] output · {name} …", flush=True)
        _get_output_scanner(name)
        done += 1
    print("✅  All models loaded and ready.")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    warmup = "--warmup" in sys.argv

    print("🛡️  LLM Guard sidecar starting on http://localhost:5002")
    print("    Input  scanners available:", list(INPUT_SCANNER_MAP.keys()))
    print("    Output scanners available:", list(OUTPUT_SCANNER_MAP.keys()))

    if warmup:
        warmup_all()
    else:
        print("    Models download from HuggingFace on first use.")
        print("    Tip: run with --warmup to pre-download all models now.")

    app.run(host="127.0.0.1", port=5002, debug=False)
