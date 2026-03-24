# Code Review — 8a-ux-improvements.html

Findings from March 2026 review. Execute sequentially — each item is scoped to be a self-contained change. All changes target `dev/8a-ux-improvements.html`.

---

## Status Key

- [ ] Pending
- [x] Done
- [⏭] Skipped

---

## Pass 1 — Trivial Sweep (bugs + dead code)

> ⚠️ All four items verified against source — all were false positives from the automated review. Pass 1 has no actionable work.

### [⏭] 1. Missing `.mg-active-advisory` CSS class
**Verdict: Not an issue.** Line 4407 maps `advisory` → `mg-active-full` via the ternary fallback. No missing CSS class.

### [⏭] 2. Duplicate CSS accordion block (~2702–2750)
**Verdict: Not a duplicate.** Lines 2702–2750 add the stepper pipeline decoration (vertical gradient line + dot `::before` nodes) on top of the base accordion styles defined earlier. The two blocks are complementary layers, not duplicates.

### [⏭] 3. Unused `_gmTitles` object
**Verdict: In use.** Referenced at line 6417 — `_gmTitles[id] || id` — inside the gate modal title renderer.

### [⏭] 4. Unused `let controller` variable
**Verdict: In use.** Assigned at line 5362 (`controller = new AbortController()`) and aborted at line 4688 (`controller.abort()`). Active abort controller for the LLM stream.

---

## Pass 2 — Small (optimization + consistency)

### [ ] 5. `set()` helper defined 6 times
**Type:** Optimization
**Location:** Lines ~4105, 4156, 4168, 4193, 4233, 4274
**Issue:** Identical closure `const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; }` is copy-pasted into 6 different functions.
**Fix:** Define once at module level as `function setEl(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }`, then replace all 6 local definitions with calls to `setEl()`.

---

### [ ] 6. Static gate config objects recreated on every `setGateMode()` call
**Type:** Optimization
**Location:** Lines ~4384–4391 inside `setGateMode()`
**Issue:** `selMap`, `btnMap`, `dotMap` are object literals that never change but are allocated fresh on every call.
**Fix:** Move all three outside the function to module-level constants.

---

### [ ] 7. `style.cssText` used for LLM-Guard badge colors
**Type:** Consistency
**Location:** Lines ~5075, 5085, 5097, 5107, 5573, 5584, 5595
**Issue:** LLM-Guard input and output badges set `style.cssText = "border-color:var(--llmguard);color:var(--llmguard)"` directly. Every other gate uses `className = "scan-badge blocked"` / `"scan-badge flagged"` / `"scan-badge allowed"` and relies on CSS.
**Fix:** Add a CSS class `.scan-badge.llmguard-result` (or reuse existing classes) and replace all `style.cssText` assignments with `classList` updates.

---

### [ ] 8. Inconsistent mode-button class update (regex vs classList)
**Type:** Consistency
**Location:** Lines ~4401, 4408 inside `setGateMode()`
**Issue:** Removing the old active class uses `el.className.replace(/\bmg-active-\w+/g, "")` (regex surgery). Adding the new active class uses `el.classList.add(cls)` (clean). These should use the same API.
**Fix:** Replace the regex removal with `el.classList.remove(...el.classList)` filtered to `mg-active-*`, or simply iterate buttons and use `classList.toggle(cls, btn === activeBtn)`.

---

### [ ] 9. Repeated banner `style.cssText` strings in batch runner
**Type:** Optimization
**Location:** Lines ~7746, 7763, 7766, 7769
**Issue:** Four near-identical 100+ character inline style strings for result banners (error / success / warning variants). Hard to maintain; any colour change requires 4 edits.
**Fix:** Create CSS classes `.result-banner`, `.result-banner-error`, `.result-banner-success`, `.result-banner-warn` and replace inline styles with `className` assignments.

---

## Pass 3 — Medium (DOM caching)

### [ ] 10. 301 uncached `getElementById()` calls
**Type:** Optimization
**Location:** Throughout, hot paths in `rpUpdateGate()` (~4132–4163) and `rpFetchModelInfo()` (~4235)
**Issue:** Telemetry bar elements (`rp-total-ms`, `wf-bar-*`, gate stat spans, etc.) are queried fresh on every pipeline tick. These elements are static — they never move or get replaced.
**Fix:** At `DOMContentLoaded`, extend the existing `els` cache object (or create a separate `rpEls` object) to hold references to all right-panel stat elements. Replace `getElementById()` calls inside `rpUpdateGate()` and related functions with cached refs.
**Note:** Do this last — it touches the most code and requires careful testing of the telemetry panel.

---

## Notes

- After each pass, reload `http://localhost:3080/dev/8a` and do a quick smoke test: send a benign prompt (should pass all gates) and a jailbreak prompt (should trigger LLM-Guard or Semantic-Guard block).
- Items 1–4 are safe to do in any order.
- Items 5–9 should be done before item 10 (cleaner base to refactor from).
