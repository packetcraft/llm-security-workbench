# Chat Column UX Improvements

Backlog of UX tasks for `dev/7c-debug-inspector.html`, derived from the chat column audit (March 2026). Execute sequentially — each item is scoped to be a self-contained change.

---

## Status Key

- [ ] Pending
- [x] Done

---

## Quick Wins (already done)

- [x] **All security alerts collapsed by default** — removed `false` overrides from 5 BLOCK `makeAlertEl()` calls so all alerts start collapsed.
- [x] **Security alerts right-aligned** — `.message.security-alert` gets `margin-left:auto`, `max-width:88%`, `border-right` replaces `border-left`, summary row reversed.

---

## Task 1 — Demo / Audit Mode Toggle

**Priority:** High — highest ROI, hides alert noise in one click

**What:** Add a toggle button in the chat column header (or top-right of the chat box). Two modes:

- **Audit Mode** (default): full scan badges + collapsed security alerts visible
- **Demo Mode**: badges and alert elements hidden, clean chat-only view

**How to implement:**

1. Add a `<button id="demoModeBtn">` to the chat column header area. Label: `Demo` / `Audit`.
2. On click, toggle class `demo-mode` on `#chatBox` (or `body`).
3. Add CSS:
   ```css
   body.demo-mode .scan-badge { display: none; }
   body.demo-mode .message.security-alert { display: none; }
   ```
4. Persist toggle state in `sessionStorage` so it survives page refresh during a demo.

**Scope:** ~20 lines CSS + ~15 lines JS. No pipeline changes.

---

## Task 2 — User Message Bubble

**Priority:** Medium — visual separation between user prompt, LLM response, and security events

**What:** Give the user's prompt a subtle background tint and left-border accent so it reads as a distinct "bubble" rather than plain text.

**How to implement:**

1. Locate the `div.message.user-message` (or equivalent) creation in `appendUserMessage()`.
2. Add a CSS class `user-bubble` to those elements.
3. Add CSS:
   ```css
   .user-bubble {
       background: rgba(var(--primary-rgb), 0.06);
       border-left: 3px solid var(--primary);
       border-radius: 4px;
       padding: 8px 12px;
       margin-right: 10%;   /* indent from right edge */
   }
   ```
4. Check that existing `.user-label` still renders inside the bubble correctly.

**Scope:** ~10 lines CSS + 1-line JS change.

---

## Task 3 — Collapsed Alert → Opens API Inspector

**Priority:** Medium — turns every alert into a navigation shortcut

**What:** Clicking a collapsed security alert opens the API Inspector debug drawer and scrolls to / highlights the relevant gate's entry.

**Current state:** Clicking a collapsed alert expands it in-place. The `makeAlertEl()` click handler just toggles `sa-collapsed`/`sa-expanded`.

**How to implement:**

1. In `makeAlertEl()`, read the gate name from the `alertClass` argument (e.g. `alert-llmguard` → gate `llmguard`, `alert-danger` → gate `airs-inlet`).
2. When the element is `sa-collapsed` and clicked, instead of expanding:
   a. Open the debug drawer (`debugDrawer.classList.add('open')` or equivalent).
   b. Call the existing `showGateDetail(gateName)` function (or equivalent) to scroll the inspector to the correct gate row.
3. Optionally show a tooltip on hover: `"Click to inspect in API Inspector"`.

**Notes:**
- Expanding in-place (current behavior) is still useful when the drawer is not available — keep it as fallback if no gate mapping exists.
- Gate name → inspector ID mapping needed: `alert-llmguard` → `lgInput`/`lgOutput`, `alert-semantic` → `guardrail`, `alert-canary-blk` / `alert-canary-adv` → `canary`, `alert-danger` → `airsInlet`.

**Scope:** ~30 lines JS. No CSS changes.

---

## Task 4 — Single Shield Badge Consolidation (Post-Scan Collapse)

**Priority:** Low — polish, complex to implement correctly

**What:** After all gates complete (pipeline finishes), collapse the per-gate scan badges (🔬 Safe, 🧩 Safe, 🐦 Safe…) into a single composite shield pill showing the overall result.

Example final state pill: `🛡 All Clear · 1.2s` or `🛡 3 Flagged · 824ms`

**How to implement:**

1. After the last gate result is received (detect via existing pipeline completion callback), gather all `.scan-badge` elements in the current message.
2. Compute aggregate: count blocked/flagged/safe, sum total latency.
3. Replace all individual badges with one `<span class="shield-pill">` showing the aggregate.
4. The individual badges should be stored in a data attribute or hidden `<span>` so they can be re-expanded on hover if needed.

**Notes:**
- This requires knowing when the full pipeline is "done" — already tracked in the pipeline orchestrator (the final `llmguardOutput` gate completes last).
- Hover-to-expand is optional for v1 — static collapse is sufficient.
- Skip if AIRS gates are `Off` (fewer badges to collapse, threshold logic needed).

**Scope:** ~60–80 lines JS + ~20 lines CSS. Non-trivial — do after Tasks 1–3.

---

## Notes

- All tasks target `dev/7c-debug-inspector.html` only.
- After completing each task, test with a BLOCK prompt (e.g. a jailbreak) and an Advisory prompt (e.g. credit card number) to verify alert rendering.
- Tasks 1 and 2 are CSS-heavy and safe to do in any order. Tasks 3 and 4 depend on understanding the existing JS pipeline.
