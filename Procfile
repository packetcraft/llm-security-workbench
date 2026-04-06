# LLM Security Workbench — Procfile
# Run all services with: honcho start   (or: foreman start)
# Install honcho: pip install honcho
#
# Ollama must be started separately: ollama serve
# (browser calls it directly on :11434 — it is not proxied)
#
# Comment out services you don't need (e.g. no AIRS key → comment airs-sdk)

proxy:      npm start
llmguard:   npm run llmguard
canary:     npm run canary
# airs-sdk:   npm run airs-sdk
# model-scan: npm run model-scan
