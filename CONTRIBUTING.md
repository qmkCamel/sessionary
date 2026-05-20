# Contributing

Thanks for helping make Sessionary better. This project is a local-first AI
coding session ledger, so contribution quality includes both product behavior
and privacy boundaries.

## Development Setup

Requirements:

- Node.js 20.19 or newer
- npm 10 or newer
- Rust 1.95.0
- Tauri system dependencies for your operating system

Install dependencies and start the app:

```bash
npm ci
npm run tauri:dev
```

For a browser-only frontend preview:

```bash
npm run dev:web
```

Some native commands are only available in the Tauri app. The web preview uses
fallback data where needed.

## OpenSpec Workflow

Non-trivial changes must start with an OpenSpec change:

```bash
mkdir -p openspec/changes/<change-id>/specs/<capability>
```

Each change should include:

- `proposal.md`: background, goals, non-goals, value, success criteria
- `design.md`: design choices, data impact, privacy constraints, validation
- `tasks.md`: an executable checklist
- `specs/<capability>/spec.md`: ADDED or MODIFIED requirements with scenarios

OpenSpec documents are written in Chinese by default. Keep necessary technical
terms in English.

Run:

```bash
npm run openspec:validate
```

## Validation

Before opening a pull request, run:

```bash
npm run openspec:validate
npm run typecheck
npm run build
npm test
```

For UI changes, also run the app locally and verify the affected screens. Add a
screenshot or short note in the PR description.

## Privacy Rules

Do not commit real local session logs, prompts, responses, customer data,
credentials, or private project paths. Use synthetic examples in `fixtures/` and
fallback data.

Do not add network upload, telemetry, account, sync, or team analytics behavior
without a dedicated OpenSpec change that explicitly covers local-first and
privacy impact.

## Pull Request Expectations

Good PRs include:

- a focused scope
- linked OpenSpec change for non-trivial work
- tests or a clear explanation for why tests are not needed
- validation output
- privacy impact notes
- screenshots for visible UI changes

Small documentation typo fixes do not need a full OpenSpec change.
