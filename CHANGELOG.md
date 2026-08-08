# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-08-08

### Added

- Multi-provider AI chat architecture: OpenRouter, Google Gemini, Anthropic, and Ollama (local), all implemented against a single `ChatProvider` interface
- Local LLM support via Ollama — no API key required
- API-key based provider support, with keys entered and stored client-side only
- Streaming chat responses with stop/retry
- Conversation management: create, rename, duplicate, branch (continue from any message), archive, and delete
- Folders and pinning for organizing conversations
- Projects — grouped conversations with a default provider/model and standing instructions
- Prompt Library with variables/templates, tags, version history, and JSON/Markdown import-export
- File attachments, with per-provider capability checks (a provider that doesn't support an attachment type is flagged, not silently accepted)
- Conversation statistics (message/character/token counts, attachments, provider/model, timestamps)
- Workspace search and a Command Palette (conversations, prompts, projects, and generated artifacts)
- Keyboard shortcuts for opening the Command Palette and starting a new conversation
- Export: single conversations, multiple conversations, whole projects, and the Prompt Library, as Markdown, JSON, or ZIP
- Local-first persistence (IndexedDB, with automatic localStorage and in-memory fallbacks) — no account, no server-side storage
- Five visual themes — Light, Dark, Minimal, Neumorphism, Skeuomorphism — selectable in Settings and persisted
- New favicon and app icon set, web manifest, and Open Graph metadata
- A top-level error boundary with a friendly recovery UI, and a startup loading screen

### Improved

- Bundle size and load performance: code-split modals, a curated syntax-highlighting language set, lazy-loaded ZIP export, and debounced search
- Accessibility: computed (not eyeballed) WCAG AA contrast across every theme, focus trapping and Escape handling in every dialog, visible focus indicators, and screen-reader-friendly live regions for streaming messages
- Consistent hover transitions, disabled-state styling, and themed scrollbars across the app
- `prefers-reduced-motion` support

### Fixed

- Attachment preview memory leaks (blob URLs are now revoked on removal, send, clear, conversation deletion, and app teardown)
- A stale model list after correcting an already-entered API key
- Duplicated download logic consolidated into a single, tested helper

### Release

- First stable release of Pawan AI Chatbot.
