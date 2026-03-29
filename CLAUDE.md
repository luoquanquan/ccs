# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run all tests
npm test

# Run a single test by name pattern
node --test --test-name-pattern "ccs use" test/**/*.test.js

```

## Architecture

ESM-only Node.js CLI published as `@luoquanquan/ccs`. Entry point is `bin/ccs.js` which wires Commander commands to handlers in `src/commands.js`. Before every command (except `completion`), `ensureConfig()` runs to initialize `~/.claude/ccs-data/config.json` with a built-in `anthropic` provider if it doesn't exist.

**Module responsibilities:**

- `src/config.js` — File path constants (`CCS_CONFIG`, `CLAUDE_SETTINGS`, `SETTINGS_BACKUP`), JSON read/write helpers, config bootstrap
- `src/providers.js` — `PRESETS` map, `splitEnvVars` (splits proxy vs app vars), `findProviderByName`, `pingProvider`
- `src/shellrc.js` — Shell RC file management: writes/replaces `# CCS_START` / `# CCS_END` marker blocks, detects shell RC path from `$SHELL`
- `src/prompts.js` — Inquirer prompt wrappers for interactive input
- `src/format.js` — `formatLastUsedAt`, `maskSecret` for display

**Key design: env var split**

`ccs use` splits a provider's `envVars` into two buckets:
- `HTTP_PROXY` / `HTTPS_PROXY` → written to shell RC file inside marker block (requires `source <rc>` to take effect)
- All other vars (e.g. `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`) → written to `~/.claude/settings.json` `env` field (requires Claude Code restart)

**Data files (all under `~/.claude/`):**

| Path | Purpose |
|------|---------|
| `ccs-data/config.json` | Provider list + `current` pointer |
| `settings.json` | Claude Code settings (app env vars written here on switch) |
| `ccs-data/settings.backup.json` | Auto-backup of settings.json before each switch |

## Testing

Uses Node.js built-in test runner (`node --test`). Test helpers are in `test/helpers.js` — they set up temp directories to isolate file system side effects. No external test framework.
