# CLAUDE.md

## Project

Terminal dashboard (ink/React TUI) monitoring z.ai GLM API usage, Claude usage, GitHub Copilot usage, Antigravity AI usage, and Gemini CLI usage. Seven panels: Claude Usage, Antigravity Usage, Copilot Usage, Gemini CLI, GLM Coding Plan, Model Usage (hidden), Tool Usage (hidden).

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
- **Antigravity client**: `src/api/antigravity.ts` — standalone client and parser
- **Copilot client**: `src/api/copilot.ts` — `getCopilotToken()` (env var → opencode auth.json → `gh auth token` → null) + `fetchCopilotUsage(token)`; exchanges token via `copilot_internal/v2/token`, then fetches quota from `copilot_internal/user`
- **Gemini client**: `src/api/gemini.ts` — `getGeminiToken()` (env var → macOS Keychain `gemini-cli-oauth` → `~/.gemini/oauth_creds.json` → null) + `fetchGeminiUsage(token)`; calls `loadCodeAssist` to resolve project ID, then `retrieveUserQuota` for per-model `BucketInfo[]`; expired tokens refreshed via OAuth if `GEMINI_OAUTH_CLIENT_ID`/`GEMINI_OAUTH_CLIENT_SECRET` are set
- **State/polling**: `src/components/App.tsx` — owns all `ApiState<T>`, `Promise.allSettled` for independent panel failures, `setInterval` for polling
- **Toggle**: `showDetails` state in `App.tsx`, toggled with `[d]` key — controls visibility of `ModelUsagePanel` and `ToolUsagePanel`

## Layout

```
┌── Claude Usage ──┐  ┌── Antigravity ───┐  ┌── GLM Coding Plan ──┐  ┌── Copilot Usage ──┐  ┌── Gemini CLI ─────┐
│                  │  │                  │  │                     │  │                   │  │                   │
└──────────────────┘  └──────────────────┘  └─────────────────────┘  └───────────────────┘  └───────────────────┘
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
- **Copilot token resolution**: `GITHUB_COPILOT_TOKEN` env var → `~/.local/share/opencode/auth.json` (`github-copilot.refresh`/`access`) → `gh auth token` CLI. Token exchanged via `copilot_internal/v2/token` before calling `copilot_internal/user` quota API.
- **Antigravity Connect RPC**: uses `--https_server_port` (not `--extension_server_port`) and `--csrf_token` from the LSP process command line. Google One AI users (`g1-*-tier`): `planStatus.availablePromptCredits` is an internal Windsurf counter unrelated to Google One credit balance — suppress prompt credits display for these users, show only per-model `remainingFraction` bars.
- **Gemini token refresh**: requires `GEMINI_OAUTH_CLIENT_ID` + `GEMINI_OAUTH_CLIENT_SECRET` env vars (no hardcoded defaults). Without them, expired tokens are not refreshed and the panel shows an auth error.
- **Gemini loadCodeAssist**: `ideType` must be `IDE_UNSPECIFIED`, `platform` must be `PLATFORM_UNSPECIFIED` — other enum values (e.g. `CLOUD_SHELL`, `OTHER`) return 400.

## Types (`src/types/index.ts`)

- `ModelUsageData` — `{ x_time[], modelCallCount[], tokensUsage[], totalUsage }`
- `ToolUsageData` — `{ x_time[], networkSearchCount[], webReadMcpCount[], zreadMcpCount[], totalUsage }`
- `QuotaLimitData` — `{ limits: QuotaLimitItem[], level }` (shown as "GLM Coding Plan")
- `ClaudeUsageData` — `{ planName, fiveHour, sevenDay, fiveHourResetAt, sevenDayResetAt }`
- `AntigravityData` — `{ email?, promptCredits?, models: AntigravityModelInfo[] }`
- `CopilotUsageData` — `{ entitlement, remaining, unlimited, resetDate }`
- `GeminiModelQuota` — `{ modelId, remainingAmount?, remainingFraction, tokenType?, resetTime? }`
- `GeminiUsageData` — `{ authType, pooledResetTime, models: GeminiModelQuota[] }`

## Environment

```
ZAI_API_KEY           # required
POLL_INTERVAL_MS      # default 300000 (5 minutes)
DAYS_BACK             # default 7
CLAUDE_ACCESS_TOKEN      # optional; macOS reads Keychain automatically if unset
GITHUB_COPILOT_TOKEN     # optional; auto-detected from opencode auth.json or gh CLI
GEMINI_OAUTH_TOKEN       # optional; auto-detected from Keychain or ~/.gemini/oauth_creds.json
GEMINI_OAUTH_CLIENT_ID   # optional; required for token auto-refresh
GEMINI_OAUTH_CLIENT_SECRET  # optional; required for token auto-refresh
```
