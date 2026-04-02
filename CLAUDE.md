# CLAUDE.md

## Project

Terminal dashboard (ink/React TUI) that polls three z.ai monitor API endpoints and displays usage stats.

## Commands

```bash
pnpm dev        # Start dashboard (tsx, no build needed)
pnpm build      # tsc → dist/
pnpm start      # node dist/index.js
```

## Architecture

- **Entry**: `src/index.tsx` — loads `.env`, validates `ZAI_API_KEY`, renders `<App>`
- **API client**: `src/api/zai.ts` — `createZaiClient(apiKey)` factory; `model-usage` and `tool-usage` require `startTime`/`endTime` params in `yyyy-MM-dd HH:mm:ss` format
- **State/polling**: `src/components/App.tsx` — owns all `ApiState<T>`, uses `Promise.allSettled` so panels fail independently, `setInterval` for polling
- **Display**: one typed component per endpoint (`ModelUsage`, `ToolUsage`, `QuotaLimit`)

## Key Constraints

- **Module system**: ESM only (`"type": "module"`, `"module": "NodeNext"`). All source imports must use `.js` extensions even though source files are `.ts`/`.tsx`.
- **ink v5 + React 18**: do not upgrade to ink v6 without also upgrading to React 19.
- **API datetime format**: `startTime`/`endTime` must be `yyyy-MM-dd HH:mm:ss` (URL-encoded space). Epoch ms or ISO 8601 are rejected with a 500 error.

## Types

Real response shapes are typed in `src/types/index.ts`:
- `ModelUsageData` — `{ x_time[], modelCallCount[], tokensUsage[], totalUsage }`
- `ToolUsageData` — `{ x_time[], networkSearchCount[], webReadMcpCount[], zreadMcpCount[], totalUsage }`
- `QuotaLimitData` — `{ limits: QuotaLimitItem[], level }`

## Environment

```
ZAI_API_KEY       # required
POLL_INTERVAL_MS  # default 30000
DAYS_BACK         # default 7
```
