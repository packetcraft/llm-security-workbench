# LLM Security Research & Implementation Plan

This document outlines prioritized extensions for the LLM Security Workbench (v3.1) based on industry-leading open-source projects.

## Proposed Extensions

### 1. Enhanced "Batch Threat Runner" (Dynamic Red Teaming)
- **Status**: Currently supports `garak` and `JailbreakBench` static imports.
- **Improvement**: Transition from static replay to **Dynamic Probing**.
- **Addition**: Integrate a "Live Probe" mode using an external "Attacker LLM" (inspired by PyRIT's `PAIR` or `TAP`) to adapt attacks in real-time.

### 2. Runtime Protection (LLM WAF Layer)
- **Projects**: **Rebuff**, **Vigil**, **VibraniumDome**.
- **Goal**: Prevent prompt injection and data exfiltration in real-time.
- **Addition**: Implement a "Protection Proxy" (inspired by Vigil) that uses fast heuristics to intercept malicious prompts at the input boundary.

### 3. Incident Detection & Security Audit
- **Goal**: Identify and log security boundary breaches for forensic analysis.
- **Addition**: Create an "Incident Logs" view (inspired by LLM Incident Manager) with tamper-evident hashing and automated threat classification.

### 4. Security Observability Trace
- **Projects**: **Langfuse**, **Phoenix**.
- **Goal**: Deep dive into security latency and the "Chain of Thought".
- **Addition**: Visual "Audit Trail" in the Debug Panel showing exactly which security layer flagged a specific threat and why.

## Implementation Roadmap
1. **Phase 1**: Enhance Batch Runner with Dynamic Probing (Red Teaming).
2. **Phase 2**: Implement the Runtime Protection (LLM WAF) layer.
3. **Phase 3**: Add Incident Logging and Security Observability views.
