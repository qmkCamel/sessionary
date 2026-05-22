# Privacy

Sessionary is designed as a local-first desktop app. Its job is to help you
review local AI coding sessions without sending your session data to a remote
service.

## What Sessionary Reads

By default, Sessionary can scan metadata from these local paths:

- `~/.codex/sessions`
- `~/.codex/archived_sessions`
- `~/.claude/projects`
- `~/.claude`

You can edit data source paths in the app settings. Sessionary also reads local
Git metadata for project context when available.

## What Sessionary Stores

Sessionary stores its local SQLite database in the operating system application
data directory:

- macOS: `~/Library/Application Support/Sessionary/sessionary.sqlite`
- Linux: usually `~/.local/share/Sessionary/sessionary.sqlite`
- Windows: usually `%APPDATA%\\Sessionary\\sessionary.sqlite`

The exact path can vary by platform and Tauri runtime conventions.

Optional GitHub and Linear access tokens are stored in macOS Keychain as generic
password entries under the `Sessionary` service. They are not stored in SQLite
and are not included in SQLite backups.

Local backups created by Sessionary copy the SQLite database to the application
data directory under `Sessionary/backups/`. These backups contain local session
metadata and annotations, but not Keychain credentials.

## What Sessionary Does Not Do

Sessionary does not intentionally upload:

- prompts or responses
- source files
- local file paths
- session metadata
- settings
- SQLite data

The app does not include accounts, cloud sync, team analytics, or telemetry.

## Deleting Local Data

To reset Sessionary, quit the app and delete the local SQLite database from the
application data directory listed above. The original Codex and Claude Code log
files are owned by those tools and are not deleted by Sessionary.

## Fixtures And Mock Data

The files in `fixtures/` and the frontend fallback data are synthetic examples.
They should not contain real prompts, private source paths, customer data, or
credentials.

## Security Reports

Please do not open a public issue for a vulnerability that could expose private
session data. See [SECURITY.md](SECURITY.md) for the reporting process.
