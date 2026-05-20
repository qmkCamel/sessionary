# Sessionary MVP Implementation Decisions

Date: 2026-05-19

## Decisions

- The MVP is implemented as Tauri 2 + React + TypeScript + Rust, matching the technical architecture document.
- Rust owns local ingestion, Codex and Claude parsing, SQLite persistence, overlap calculation, annotation updates, and Markdown report export.
- React owns the desktop workspace UI: Today, Session Inbox, Project Timeline, Daily Report, and the right-side session detail panel.
- SQLite is stored in the OS application data directory under `Sessionary/sessionary.sqlite`.
- The app scans Codex logs from `~/.codex/sessions` and `~/.codex/archived_sessions`.
- The app scans Claude logs from `~/.claude/projects` and `~/.claude`. The current machine did not have Claude JSONL logs, so Claude parser behavior is verified with fixture data.
- Full prompt and response bodies are not stored as separate records. The database stores metadata, counts, short summaries, file path hints, and user annotations.
- Human prompting, waiting, review, and repair time are estimated by default and become manual when edited in the session detail panel.
- Annotation fields are preserved across rescans so parser refreshes do not erase status, notes, or manual time corrections.
- Because Rust was not initially on PATH, it was installed and activated locally through `mise` with `rust@stable`.
- The MVP build target is the macOS `.app` bundle. DMG packaging was disabled after the local `bundle_dmg.sh` step failed, while the release binary and `.app` bundle built and launched successfully.

## Follow-up After MVP

- Move source paths into a Settings screen with per-source enable toggles.
- Add richer Claude Code format fixtures once real local logs are available.
- Add file watcher background scanning after the manual and startup scan flow has settled.
- Add app icons before production packaging.
