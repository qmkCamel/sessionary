# Sessionary

Local-first AI coding session ledger for Codex and Claude Code sessions.

## Run

```bash
mise install
npm install
npm run tauri:dev
```

The app scans local metadata from:

- `~/.codex/sessions`
- `~/.codex/archived_sessions`
- `~/.claude/projects`
- `~/.claude`

SQLite data is stored in the OS application data directory under `Sessionary/sessionary.sqlite`.

## Verify

```bash
npm run typecheck
npm run build
cd src-tauri && mise exec -- cargo test
```

## MVP Coverage

- Today dashboard with session, project, estimated time, and parallel metrics.
- Session Inbox with filters, keyboard cleanup, status annotation, notes, and manual time correction.
- Project Timeline with project tracks, session blocks, and overlap bands.
- Daily Report generation, editing, clipboard copy, and local Markdown export.
- Rust parsers for Codex JSONL and Claude Code JSONL.
- Local SQLite persistence and annotation preservation across rescans.
- Overlap calculation for sessions and cross-project parallel work.
