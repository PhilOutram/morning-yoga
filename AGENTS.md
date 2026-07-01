# AI Agent Instructions for the Yoga App

## Project overview

This is a small static web app for a morning stretch routine. It uses plain HTML, CSS, and JavaScript with no frontend framework, build tool, or package manager present in the repository.

## Key files

- `index.html` — app shell and UI structure
- `styles.css` — all layout and visual styling
- `app.js` — app logic, timer, audio, voice announcements, and DOM updates
- `config.js` — simple app metadata and versioning
- `poses/` — image assets for poses referenced by the app

## What an agent should know

- The app is loaded directly in the browser via `index.html`.
- `app.js` is the main source of behavior: timer loop, stretch queue, voice controls, pause/skip/reset flow, and queue rendering.
- `config.js` contains a version string and display label; bump `CONFIG.VERSION` when making visible changes.
- The app uses browser APIs directly (`speechSynthesis`, `AudioContext`, `Image`) and should remain compatible with modern browsers.
- `poses/` image files are optional; missing images are handled by a placeholder.

## Development guidance

- Prefer minimal, idiomatic vanilla JavaScript rather than adding frameworks or build tooling.
- Keep behavior and markup changes lightweight; this is a simple SPA without routing or state management libraries.
- Use the existing DOM refs and CSS class names if updating UI state or interaction.
- For UI changes, verify in a browser by opening `index.html`, since there is no automated build or test pipeline.

## When asked to modify the app

- Focus on user-facing functionality and accessibility first: timer behavior, voice controls, button interactions, and mobile-friendly layout.
- Preserve the current style: a calm, simple routine experience with a single session flow.
- Avoid introducing package.json, Node scripts, or build dependencies unless the user explicitly asks for a tooling upgrade.

## Note

No existing `.github/copilot-instructions.md`, `AGENTS.md`, or similar customization files were present before this file was added.
