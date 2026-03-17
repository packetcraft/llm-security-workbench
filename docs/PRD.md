Here is the updated and finalized **Product Requirements Document (PRD)**, incorporating the ability for users to define custom Prisma AIRS security profiles and expanding the API Inspector to show both the outgoing and incoming Prisma AIRS payloads.

---

# 📄 Product Requirements Document: Ollama Ultimate Workbench
**Version:** 2.1 (Security & Enterprise Edition)  
**Date:** March 2026  
**Status:** Feature Complete / Stable Release  

## 1. Product Overview
The **Ollama Ultimate Workbench** is a lightweight, zero-dependency, single-file browser environment designed to interface directly with local Ollama instances. It bridges the gap between rapid prompt engineering and enterprise-grade security testing. By integrating simulated Palo Alto Prisma AIRS capabilities, it allows developers and security teams to test LLMs locally while enforcing strict Data Loss Prevention (DLP) and payload inspection policies.

## 2. Target Audience
* **Prompt Engineers:** Requiring a categorized library to test system instructions and custom personas.
* **Cybersecurity Teams (Red/Blue Teams):** Testing local models for prompt injection vulnerabilities and configuring pre-flight DLP blockers.
* **Developers:** Needing a distraction-free, syntax-highlighted environment for code generation and API payload debugging.

---

## 3. Functional Requirements

### 3.1 Core LLM Interaction
* **Dynamic Model Discovery:** Automatically fetches available models via the `/api/tags` endpoint and pre-selects default models (e.g., matching `llama3.2` or `3b`).
* **Real-time Streaming:** Processes chunked responses using `ReadableStream` and the `/api/chat` endpoint.
* **Abort Generation:** A dedicated "Stop" button utilizes an `AbortController` to immediately halt API calls and free up local compute resources.
* **Robust JSON Parsing:** Incorporates a rolling buffer to prevent `Unterminated string` errors caused by split JSON chunks during high-speed streams.

### 3.2 Advanced UI/UX & Formatting
* **Markdown & Syntax Highlighting:** Live parsing of Markdown via `Marked.js` and automatic language detection/highlighting for code blocks via `Highlight.js` (GitHub Dark theme).
* **Identity Stamping:** AI response headers dynamically display the configuration used for that specific response (e.g., `AI (llama3.2:latest — PII Shield (DLP Filter))`), enabling comparative testing.
* **Smart Input:** The user prompt `textarea` auto-expands vertically based on content volume and supports `Shift + Enter` for line breaks.
* **Dark Mode:** A toggleable, persistent Dark/Light theme UI.

### 3.3 Persona Library & Management
* **Categorized Dropdown:** Uses `<optgroup>` to organize personas into logical tiers:
    * *Standard:* Code Architect, ELI5
    * *Security & Compliance:* PII Shield, Cyber Security Auditor
    * *Creative & Logic:* Professional Editor, Database Guru, Storyteller, Socratic Tutor
* **Custom Persistence:** Users can write custom system prompts, save them via a "Save as Custom Persona" button, and have them persist across browser sessions via `localStorage`. Custom personas populate dynamically in the "Custom" `<optgroup>`.

### 3.4 Prisma AIRS Integration (Security Middleware)
* **Pre-Flight Hook (Strategy 2):** Integrates a mockable middleware function (`mockPrismaAIRS`) that intercepts the user prompt before it reaches Ollama.
* **Enforcement Modes:**
    * **Strict (Block):** If sensitive data (e.g., passwords, SSNs) is detected, the UI throws a red security alert, halts execution, and prevents the payload from reaching the LLM.
    * **Audit Only (Twin-Scan):** If sensitive data is detected, the UI throws a yellow warning flag but permits the request to proceed to the LLM for visibility/auditing purposes.
    * **Off:** Bypasses security checks completely.
* **Settings UI:** A dedicated 3rd column in the settings bar containing the Mode Selector, a masked API Key input, and a **Security Profile Selector**.
* **Custom Security Profiles:** Users can select predefined profiles (e.g., `Default`, `Strict PII`) or input their own **Custom Profile ID/Name** to map directly to their organization's specific Prisma AIRS backend configurations.

### 3.5 Developer Tools (API Inspector)
* **Twin-Scan Visibility:** A collapsible debugging panel at the bottom of the UI.
* **Prisma AIRS Telemetry:** Displays **both** the exact outgoing API Request payload sent to the security middleware and the incoming JSON Response (decision matrix) returned by Prisma.
* **LLM Payload Verification:** Shows the exact JSON payload being dispatched to Ollama.
* **LLM Chunk Inspection:** Real-time display of the last raw JSON chunk received from the Ollama stream.

---

## 4. Technical Architecture

### 4.1 Frontend Stack
* **Markup/Styling:** Single-file HTML5, CSS3 Variables for theming, CSS Grid for the 3-column settings layout.
* **Scripting:** Vanilla JavaScript (ES6+), `async/await`, Fetch API.
* **Storage:** Browser `localStorage` (for custom personas and custom security profiles).

### 4.2 External Libraries (CDN)
* `marked.min.js` (Markdown parsing)
* `highlight.min.js` & `github-dark.min.css` (Code styling)

### 4.3 Security & Network Flow
1. **User Input** $\rightarrow$ **Prisma AIRS Hook** (Pre-flight DLP Check utilizing the selected Security Profile).
2. **Debug Inspector Update** $\rightarrow$ Logs Prisma Request & Response.
3. If Blocked $\rightarrow$ **Halt & Alert User**.
4. If Clear/Audit $\rightarrow$ **Compile Payload** (Model + Persona System Prompt + User Prompt).
5. **Fetch to Ollama** (`POST http://localhost:11434/api/chat`).
6. **Stream Processing** $\rightarrow$ **Buffer Stitching** $\rightarrow$ **Markdown Parsing** $\rightarrow$ **DOM Update**.

---

## 5. Security & Privacy Considerations
* **Local Data Sovereignty:** By default, all prompt processing remains on `localhost`. 
* **CORS Requirement:** Ollama must be configured with `OLLAMA_ORIGINS="*"` to accept requests from the local browser file.
* **API Key Safety:** The Prisma AIRS API key field is masked (`type="password"`). When transitioned to a real API, keys should ideally be handled via a secure backend proxy rather than exposed in client-side JS.

---

## 6. Future Roadmap (v3.0)
* **Real Prisma API Hook:** Replace the `mockPrismaAIRS` delay function with an actual `fetch` call to the Palo Alto Prisma Cloud/Access endpoint.
* **Chat Memory (Context Window):** Implement an array to store the last $N$ messages, allowing the LLM to remember conversation history within a session.
* **Export Engine:** Add functionality to download the entire chat history (and Twin-Scan debug logs) as a JSON or formatted Markdown file for audit compliance.
* **LLM Output Scanning:** Implement post-generation AIRS scanning to catch hallucinated secrets or toxic output generated *by* the AI before rendering it to the user.

---
