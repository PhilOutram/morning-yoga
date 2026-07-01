# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page "Morning Stretch" web app: a timed 5-minute guided stretch routine with
voice announcements, audio cues, and pose illustrations. Plain HTML/CSS/vanilla JS with
**no framework, build step, package manager, or tests**. See `AGENTS.md` for the
existing agent-facing overview; this file adds the architectural detail.

## Running it

There is no build or test pipeline. Open the app directly in a browser:

```sh
start index.html          # Windows: open in default browser
```

Or serve statically (avoids any file:// quirks) and open the printed URL:

```sh
python -m http.server 8000
```

Verify changes by loading the page and running a session; there is nothing to compile.

## Load order and versioning

`index.html` loads `config.js` **before** `app.js` (order matters — `app.js` reads the
global `CONFIG` at init to render the version label). `CONFIG.VERSION` in
[config.js](config.js) is a manually-maintained semver string shown in the footer.
**Bump `CONFIG.VERSION` on every visible change** — this is the project's one hard
convention (also stated in `AGENTS.md`).

## Architecture (all logic in app.js)

The whole app is procedural module-scope code in [app.js](app.js) driving the DOM in
`index.html`. Key pieces:

- **`STRETCHES` catalog vs `SESSION`** — `STRETCHES` is the full, immutable catalog; each
  entry has a stable `id`, `name`, `duration` (seconds), `tip`, `announce` (spoken text),
  and either `pose` (one image path) or, for two-sided stretches, `sides: [...]` plus a
  `poses: [...]` array. The user chooses which stretches to include (settings cog), and the
  engine actually runs off **`SESSION`** — the enabled subset in catalog order, rebuilt via
  `rebuildSession()` at each session (re)start. `sessionTotal` (dynamic, sided stretches
  counted twice) drives the session bar and clock. Adding a stretch = append to `STRETCHES`;
  the queue, totals, and settings list all follow.

- **Selection & persistence** — `selectedIds` (a `Set` of stretch ids) is the user's choice,
  persisted to `localStorage` under `STORAGE_KEY`. `loadSelection()` defaults to all ids and
  drops unknown ones; `activeList()` derives `SESSION`. The settings panel keeps at least one
  stretch enabled, and changes only take effect on the next session start (they never mutate a
  running `SESSION`).

- **State machine** — module-level `stretchIdx` (index into `SESSION`) and `sideIdx` (0 or 1
  for sided stretches) are the position; `timeLeft`, `elapsed`, `isPaused`, `voiceEnabled`,
  and `pendingAnnounce` round out the state. `advance()` is the core transition: for a
  sided stretch it runs side 0 then side 1 before incrementing `stretchIdx`; past the last
  stretch it calls `finishSession()`.

- **Timer loop** — `startTicker()` runs a 1-second `setInterval` that decrements
  `timeLeft`/`elapsed`, updates the SVG ring via `setRing()`, updates the session bar, fires
  countdown `pip()` beeps at 3/2/1s, and calls `advance()` at zero. Pause is cooperative:
  the interval keeps firing but returns early while `isPaused` is true (it is never cleared
  on pause).

- **Screens** — three mutually-exclusive views (`introScreen`, `activeArea`,
  `completeScreen`) toggled by adding/removing the `visible` CSS class. There is no router.

- **Two distinct resets** (easy to confuse):
  - `resetToStart()` — header ↺ button; tears everything down and returns to the intro screen.
  - `resetSession()` — "Stretch again" on the complete screen; restarts the active session
    from stretch 1.

- **Media, all via native browser APIs, all best-effort:**
  - Voice: `speak()` uses `speechSynthesis`, preferring a natural en-GB/en-AU voice; muted
    via `toggleVoice()`. Announcing while paused stashes text in `pendingAnnounce` and speaks
    it on resume.
  - Audio pips: `pip()` synthesizes tones with `AudioContext` (lazily created on first use).
  - Poses: `loadPose()` preloads each image off-screen and swaps it in so the container
    never reflows; **missing images fall back to an inline placeholder** (`img.onerror`), so
    the `poses/` PNGs are optional. `getPoseUrl()` picks the side-specific image for sided
    stretches.

- **DOM access** — all elements are looked up once into the `els` map via the `$` = 
  `getElementById` helper. Button handlers are wired with inline `onclick=` attributes in
  `index.html`, so handler functions must stay at module scope (global) to remain callable.

## Conventions

- Keep it dependency-free vanilla JS/CSS — do not add a framework, bundler, or `package.json`
  unless explicitly asked (per `AGENTS.md`).
- CSS uses design-token custom properties in `:root` (`--cream`, `--bark`, `--amber`, etc.);
  reuse them rather than hardcoding colors.
- `OLD Working/` is a snapshot of a previous version (v2.1.0) kept for reference — it is not
  wired into the app. Don't edit it as part of feature work.
