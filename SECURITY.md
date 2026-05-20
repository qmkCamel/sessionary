# Security Policy

## Supported Versions

Sessionary is currently an early open-source project. Security fixes target the
default branch until versioned releases are available.

| Version | Supported |
| ------- | --------- |
| `main`  | Yes       |
| Releases before `1.0` | Best effort |

## Reporting A Vulnerability

Please do not report vulnerabilities that could expose private session data in a
public issue.

Open a private security advisory on GitHub if available for this repository, or
contact the maintainer through the GitHub profile linked from the repository.

Please include:

- affected version or commit
- operating system
- steps to reproduce
- what data could be exposed or modified
- whether the issue requires a malicious local file, a crafted session log, or a
  remote input

## Scope

High-impact areas include:

- reading local Codex or Claude Code logs
- SQLite storage and export behavior
- report export paths
- Tauri command permissions
- parsing untrusted JSONL input

Dependency vulnerabilities are also welcome when they affect a shipped or
developer-executed path.
