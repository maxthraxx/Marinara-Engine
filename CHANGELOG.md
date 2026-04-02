# Changelog

This file is the release-notes source of truth for Marinara Engine. Reuse these entries when publishing GitHub Releases for tags in the `vX.Y.Z` format.

## [Unreleased]

### Added

- Added `pnpm check`, version-sync helpers, and PR CI checks for version drift.
- Added tracked-installer and release-note scripts plus a GitHub release workflow driven by `CHANGELOG.md`.

### Changed

- Startup config now resolves `.env` before env-sensitive server modules, normalizes repo-root data and SQLite paths, and keeps `/api/*` 404s JSON-only.
- Shell launchers now align on the resolved `PORT`, honor launcher-level browser auto-open consistently, and pin pnpm to the repo version.
- Android now uses a build-time WebView server URL constant instead of a hardcoded Java literal, with optional `MARINARA_PORT` support in `android/build-apk.sh`.
- The client app shell now lazy-loads editors, right-panel surfaces, onboarding, modals, and the main chat surface to reduce initial bundle weight.

### Fixed

- `CORS_ORIGINS=*` now behaves as explicit allow-all without credentials, while explicit origin lists retain credentialed CORS support.
- GIF search no longer falls back to a shared embedded API key when `GIPHY_API_KEY` is unset.
- Sidebar tab text metrics were made explicit so descenders like the `y` in `Roleplay` no longer clip.
- Restored local data-path compatibility so existing installs continue to resolve storage under `packages/server/data`.
- Update checks now resolve the newest GitHub `v*` tag even when `releases/latest` is stale.

## [1.4.7]

### Added

- **Persona Groups** — Organize personas into named groups with full CRUD backend and SQLite storage.
- **Group Scenario Override** — Replace individual character scenarios with a single shared scenario for group chats.
- **AI Persona Maker** — Generate complete personas from a prompt using your LLM connection via SSE streaming.
- **Import Persona** — Import personas from PNG character cards or JSON files.
- **Quick Connection & Persona Switchers** — Floating popover switchers anchored to the chat input.
- **Notification Bubbles** — Floating avatar notification bubbles for unread messages in background chats.

### Changed

- **Personas Panel Redesign** — Search, sort, active/inactive filter, plus New, Import, and AI Maker action buttons.
- **Quick Switcher Vertical Alignment** — Desktop quick switchers anchor to the input box container's top border.
- **Conversation Edit Simplification** — Removed keyboard shortcuts from message editing; explicit cancel/save buttons only.
- **Blank Line Collapsing** — Runs of 3+ consecutive newlines collapsed to a double newline.
- **OpenRouter Thinking/Content Block Parsing** — Correctly parses thinking and content blocks from reasoning models.
- **Claude 4.5/4.6 Temperature-Only Sampling** — Omits `top_p` for Claude models that only support temperature.

### Fixed

- Fixed quick switcher flash at (0,0) on mount.
- Fixed notification bubbles not triggering from normal generation path.
- Fixed notification character ID parsing (JSON string now properly parsed).
- Fixed empty conversation response guard.
- Fixed memory recall scoping.
- Fixed Lorebook Keeper scoping.
- Fixed missing `persona_groups` DB migration.

## [1.4.6]

### Added

- **Bot Browser** — Browse, search, and one-click import characters from Chub.ai directly inside the app. Includes paginated grid view, sort by downloads, stars, or trending, an NSFW filter toggle, and full character detail previews.
- **Chat Folders** — Organize chats into named, color-coded folders with drag-and-drop reorder. Move chats between folders, collapse or expand them, and filter by mode. State is persisted server-side.
- **Slash Commands** — Added SillyTavern-style commands with autocomplete, including `/roll`, `/sys`, `/narrator`, `/continue`, `/as <character>`, `/impersonate`, `/remind <time> <message>`, `/random`, `/scene`, and `/help`.
- **AI Lorebook Maker** — Generate structured lorebook entries from a topic prompt using your LLM connection, with SSE streaming, batch support, and attach-to-existing-lorebook support.
- **Connection Duplicate & Test** — Clone existing connections, including encrypted API keys, and test connectivity with provider-specific checks.
- **ComfyUI Custom Workflows** — Paste custom workflow JSON with `%prompt%`, `%negative_prompt%`, `%width%`, `%height%`, `%seed%`, and `%model%` placeholders.
- **OpenRouter Provider Preference** — Select a preferred upstream provider when routing through OpenRouter.
- **Expanded Image Generation** — Added Pollinations, Stability AI, Together AI, NovelAI, ComfyUI, and AUTOMATIC1111 / SD Web UI alongside OpenAI-compatible image generation.
- **Plain Text Chat Export** — Export chat history as readable plain text alongside the existing JSONL format.
- **Embedding Base URL** — Configure a per-connection base URL for embedding endpoints.

### Changed

- **Performance — Streaming Re-render Optimization** — Extracted streaming UI into isolated components so the main chat area no longer re-renders on every streamed token.
- **Performance — Zustand Selector Batching** — Combined UI store selectors with shallow comparison and memoized style objects to reduce unnecessary re-renders.
- **Performance — Debounced UI Persistence** — Debounced `localStorage` writes and added unload or visibility flushes to reduce churn without losing data.
- **Chat Text Appearance** — Unified chat text color under a single setting and set the default text stroke width to `0.5px`.
- **Folder UX** — New folders now appear at the top, render above unfiled chats, and support inline rename plus hover-delete affordances.
- **Roleplay Input Responsiveness** — Tightened responsive spacing and flex behavior in the input bar to prevent overflow.
- **Home Page Mobile Layout** — Reduced mobile padding, constrained content width, and improved QuickStart card responsiveness.
- **Tracker Injection Order** — Tracker data now injects before Output Format for correct prompt ordering.
- **Settings Panel Polish** — Renamed reset actions to "Reset to default", removed redundant labels, and consolidated reset behavior.

### Fixed

- **Infinite re-render loop** — Wrapped the combined Zustand selector in `useShallow()` so `memo()` can short-circuit correctly.
- **Message background opacity** — Corrected roleplay bubble colors to match the intended Tailwind neutral palette.
- **New folders appearing at the bottom** — Fixed both the server-side sort order assignment and the client-side render ordering.
- **Missing DB column migrations** — Added `openrouter_provider`, `comfyui_workflow`, and `embedding_base_url` to startup column migrations.
- **Combat encounter `parseJSON`** — Corrected escape-sequence handling and added multi-stage sanitization for AI responses.
- **Additional fixes and polish** — Includes smaller bug fixes that shipped as part of the same release.
