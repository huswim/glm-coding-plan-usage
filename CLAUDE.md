# CLAUDE.md

## Project

Terminal dashboard (ink/React TUI) monitoring z.ai GLM API usage, Claude usage, and Antigravity AI usage. Five panels: Claude Usage, Antigravity Usage, GLM Coding Plan, Model Usage (hidden), Tool Usage (hidden).

## Commands

```bash
pnpm dev        # Start dashboard (tsx, no build needed)
pnpm build      # tsc → dist/
pnpm start      # node dist/index.js
```

## Architecture

- **Entry**: `src/index.tsx` — loads `.env`, validates `ZAI_API_KEY`, renders `<App>`
- **z.ai client**: `src/api/zai.ts` — `createZaiClient(apiKey)` factory; `model-usage` and `tool-usage` require `startTime`/`endTime` in `yyyy-MM-dd HH:mm:ss` format
- **Claude client**: `src/api/claude.ts` — `getClaudeAccessToken()` (env var → macOS Keychain → null) + `fetchClaudeUsage(token)`
- **Antigravity client**: `src/api/antigravity.ts` — orchestrator; `src/api/antigravity/` contains process-detector, port-detective, port-prober, connect-client, local-parser
- **State/polling**: `src/components/App.tsx` — owns all `ApiState<T>`, `Promise.allSettled` for independent panel failures, `setInterval` for polling
- **Toggle**: `showDetails` state in `App.tsx`, toggled with `[d]` key — controls visibility of `ModelUsagePanel` and `ToolUsagePanel`

## Layout

```
┌── Claude Usage ──┐  ┌── Antigravity ───┐  ┌── GLM Coding Plan ──┐
│                  │  │                  │  │                     │
└──────────────────┘  └──────────────────┘  └─────────────────────┘
# [d] toggles:
┌── Model Usage ───┐  ┌── Tool Usage ────┐
│                  │  │                  │
└──────────────────┘  └──────────────────┘
```

## Key Constraints

- **Module system**: ESM only (`"type": "module"`, `"module": "NodeNext"`). All source imports must use `.js` extensions.
- **ink v5 + React 18**: do not upgrade to ink v6 without also upgrading to React 19.
- **API datetime format**: `startTime`/`endTime` must be `yyyy-MM-dd HH:mm:ss` (URL-encoded space). Epoch ms or ISO 8601 are rejected with a 500 error.
- **Claude token on macOS**: auto-read from Keychain (`Claude Code-credentials`). Set `CLAUDE_ACCESS_TOKEN` env var to override or use in Docker.
- **Antigravity Connect RPC**: uses `--https_server_port` (not `--extension_server_port`) and `--csrf_token` from the LSP process command line. Google One AI users (`g1-*-tier`): `planStatus.availablePromptCredits` is an internal Windsurf counter unrelated to Google One credit balance — suppress prompt credits display for these users, show only per-model `remainingFraction` bars.

## Types (`src/types/index.ts`)

- `ModelUsageData` — `{ x_time[], modelCallCount[], tokensUsage[], totalUsage }`
- `ToolUsageData` — `{ x_time[], networkSearchCount[], webReadMcpCount[], zreadMcpCount[], totalUsage }`
- `QuotaLimitData` — `{ limits: QuotaLimitItem[], level }` (shown as "GLM Coding Plan")
- `ClaudeUsageData` — `{ planName, fiveHour, sevenDay, fiveHourResetAt, sevenDayResetAt }`
- `AntigravityData` — `{ email?, promptCredits?, models: AntigravityModelInfo[] }`

## Environment

```
ZAI_API_KEY           # required
POLL_INTERVAL_MS      # default 30000
DAYS_BACK             # default 7
CLAUDE_ACCESS_TOKEN   # optional; macOS reads Keychain automatically if unset
```
