# Sessionary MVP Implementation Decisions

Date: 2026-05-19

## Decisions

- The MVP is implemented as Tauri 2 + React + TypeScript + Rust, matching the technical architecture document.
- Rust owns local ingestion, Codex and Claude parsing, SQLite persistence, overlap calculation, annotation updates, and Markdown report export.
- React owns the desktop workspace UI: Today, Session Inbox, Project Timeline, Daily Report, and the right-side session detail panel.
- SQLite is stored in the OS application data directory under `Sessionary/sessionary.sqlite`.
- First launch uses an onboarding screen with editable local paths. After onboarding, the same fields live in Settings / Data Sources with per-source toggles.
- The default Codex paths are `~/.codex/sessions` and `~/.codex/archived_sessions`.
- The default Claude paths are `~/.claude/projects` and `~/.claude`. The current machine did not have real Claude JSONL logs, so Claude Code projects and OpenTelemetry-style parsing are verified with fixtures.
- Full prompt and response bodies are not stored as separate records. The database stores metadata, counts, short summaries, file path hints, and user annotations.
- Human prompting, waiting, review, and repair time are estimated by default and become manual when edited in the session detail panel.
- Review time has a manual `Start Review` / `Done` / `Needs Repair` flow. If a user does not run that timer, the existing estimated review value remains visible and editable.
- Annotation fields are preserved across rescans so parser refreshes do not erase status, notes, or manual time corrections.
- Timeline zoom is implemented as 15m / 30m / 60m snapping around the active sessions for the selected day.
- Timeline drag selection is implemented as a range summary, not a persisted annotation. This keeps it lightweight for MVP and avoids creating ambiguous saved time entries.
- Git file-change clues use parser-extracted file paths plus current `git status --porcelain` paths for the repo. This is a clue list, not exact line ownership attribution.
- Inbox cleanup keeps a changed session visible briefly and then advances selection to the next visible item. The pause is local UI behavior and is not persisted.
- Because Rust was not initially on PATH, it was installed and activated locally through `mise` with `rust@stable`.
- The MVP build target is the macOS `.app` bundle. DMG packaging was disabled after the local `bundle_dmg.sh` step failed, while the release binary and `.app` bundle built and launched successfully.

## Follow-up After MVP

- Add file watcher background scanning after the manual and startup scan flow has settled.
- Add app icons before production packaging.
