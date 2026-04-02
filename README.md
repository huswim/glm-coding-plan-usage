# glm-coding-plan-usage

Terminal dashboard for monitoring [z.ai](https://z.ai) GLM API usage in real time.

## Features

- Live polling of model usage, tool usage, and quota/limit from the z.ai monitor API
- Progress bars for quota consumption
- Auto-refresh (default every 30s), configurable time window
- Each panel fails independently — one error doesn't block the others

## Setup

```bash
cp .env.example .env
# Edit .env and set ZAI_API_KEY
pnpm install
pnpm dev
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ZAI_API_KEY` | required | Your z.ai API key |
| `POLL_INTERVAL_MS` | `30000` | Refresh interval in milliseconds |
| `DAYS_BACK` | `7` | Time window for usage queries (days) |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `r` | Force refresh |
| `q` / `Esc` | Quit |

## Project Structure

```
src/
├── index.tsx              # Entry point
├── api/zai.ts             # z.ai API client
├── types/index.ts         # TypeScript interfaces
├── utils/flatten.ts       # Data flattening utilities
└── components/
    ├── App.tsx            # Root: state, polling, keyboard
    ├── Header.tsx         # Title bar
    ├── ModelUsage.tsx     # Model calls + token totals
    ├── ToolUsage.tsx      # Tool call breakdowns
    ├── QuotaLimit.tsx     # Quota limits with progress bars
    └── StatusBar.tsx      # Last updated / error status
```

## API Endpoints

| Panel | Endpoint |
|---|---|
| Model Usage | `GET /api/monitor/usage/model-usage?startTime=...&endTime=...` |
| Tool Usage | `GET /api/monitor/usage/tool-usage?startTime=...&endTime=...` |
| Quota / Limits | `GET /api/monitor/usage/quota/limit` |

> **Note:** `model-usage` and `tool-usage` require `startTime`/`endTime` in `yyyy-MM-dd HH:mm:ss` format.

## Scripts

```bash
pnpm dev      # Run with tsx (no build step)
pnpm build    # Compile to dist/
pnpm start    # Run compiled dist/index.js
```
