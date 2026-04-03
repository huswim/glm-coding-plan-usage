# glm-coding-plan-usage

Terminal dashboard for monitoring [z.ai](https://z.ai) GLM API usage, Claude usage, GitHub Copilot usage, Antigravity AI usage, and Gemini CLI usage in real time.

## Features

- **GLM Coding Plan** — quota limits with progress bars and reset times
- **Claude Usage** — 5-hour and 7-day utilization from Anthropic's API
- **GitHub Copilot Usage** — premium request quota with entitlement tracking, usage progress, and reset date
- **Antigravity Usage** — model quota bars read from the local Antigravity language server via Connect RPC
- **Gemini CLI Usage** — per-model quota fractions from Google's Cloud Code Assist API
- **Model & Tool Usage** — hidden by default, toggle with `[d]`
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
| `CLAUDE_ACCESS_TOKEN` | — | Claude OAuth token (macOS: auto-read from Keychain if unset) |
| `GITHUB_COPILOT_TOKEN` | — | GitHub token (auto-detected from opencode auth.json or `gh` CLI if unset) |
| `GEMINI_OAUTH_TOKEN` | — | Gemini OAuth token (auto-detected from macOS Keychain or `~/.gemini/oauth_creds.json` if unset) |
| `GEMINI_OAUTH_CLIENT_ID` | — | OAuth client ID — required for automatic token refresh |
| `GEMINI_OAUTH_CLIENT_SECRET` | — | OAuth client secret — required for automatic token refresh |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `r` | Force refresh |
| `d` | Toggle Model / Tool usage detail panels |
| `q` / `Esc` | Quit |

## Layout

```
┌── Claude Usage ─────┐  ┌── Antigravity ──────┐  ┌── GLM Coding Plan ──┐  ┌── Copilot Usage ─────┐
│  5h  ████░  45%     │  │  Gemini Pro  ████░  │  │  Per 5 min  Calls   │  │  ████░░░░  50%       │
│  7d  ██░░░  20%     │  │  Claude      ████░  │  │  Monthly    Tokens  │  │  500 / 1000 left     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘  └──────────────────────┘
┌── Gemini CLI ───────┐
│  gemini-2.0-flash   │
│  ████████  100%     │
└─────────────────────┘
# press [d] to show:
┌── Model Usage ──────────┐  ┌── Tool Usage ────────────┐
│  Total Calls   574      │  │  Network Search  0       │
│  Total Tokens  27.7M    │  │  Web Read MCP    0       │
└─────────────────────────┘  └──────────────────────────┘
```

## Project Structure

```
src/
├── index.tsx              # Entry point
├── api/
│   ├── zai.ts             # z.ai API client
│   ├── claude.ts          # Claude usage API client
│   ├── copilot.ts         # GitHub Copilot quota client
│   ├── gemini.ts          # Gemini CLI quota client (cloudcode-pa API)
│   ├── antigravity.ts     # Antigravity orchestrator (process → port → RPC)
│   └── antigravity/
│       ├── process-detector.ts  # Detect Antigravity LSP process (ps aux / wmic)
│       ├── port-detective.ts    # Discover listening ports for a pid
│       ├── port-prober.ts       # Probe ports for Connect RPC endpoint
│       ├── connect-client.ts    # HTTPS Connect RPC client (GetUserStatus)
│       └── local-parser.ts      # Parse RPC response → QuotaSnapshot
├── types/index.ts         # TypeScript interfaces
├── utils/flatten.ts       # Data flattening utilities
└── components/
    ├── App.tsx            # Root: state, polling, keyboard
    ├── Header.tsx         # Title bar with keybinding hints
    ├── ClaudeUsage.tsx    # Claude 5h/7d utilization
    ├── AntigravityUsage.tsx  # Antigravity model quota bars
    ├── CopilotUsage.tsx   # GitHub Copilot quota
    ├── GeminiUsage.tsx    # Gemini CLI per-model quota bars
    ├── QuotaLimit.tsx     # GLM Coding Plan quota
    ├── ModelUsage.tsx     # Model calls + token totals (hidden by default)
    ├── ToolUsage.tsx      # Tool call breakdowns (hidden by default)
    └── StatusBar.tsx      # Last updated / error status
```

## API Endpoints

| Panel | Endpoint |
|---|---|
| GLM Coding Plan | `GET https://api.z.ai/api/monitor/usage/quota/limit` |
| Model Usage | `GET https://api.z.ai/api/monitor/usage/model-usage?startTime=...&endTime=...` |
| Tool Usage | `GET https://api.z.ai/api/monitor/usage/tool-usage?startTime=...&endTime=...` |
| Claude Usage | `GET https://api.anthropic.com/api/oauth/usage` |
| Antigravity | `POST https://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/GetUserStatus` (local) |
| Gemini CLI | `POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist` + `:retrieveUserQuota` |

> **Note:** `model-usage` and `tool-usage` require `startTime`/`endTime` in `yyyy-MM-dd HH:mm:ss` format.
>
> **Antigravity:** Reads from the locally running Antigravity language server process. Detects port and CSRF token automatically from the process command line. Requires Antigravity to be running. Google One AI plan users: prompt credits are not shown (the `GetUserStatus` endpoint does not expose Google One credit balance — only per-model quota fractions are reliable).
>
> **Gemini CLI:** Requires the Gemini CLI to have completed OAuth onboarding. Token is auto-detected from the macOS Keychain (`gemini-cli-oauth`) or `~/.gemini/oauth_creds.json`. Automatic token refresh requires `GEMINI_OAUTH_CLIENT_ID` and `GEMINI_OAUTH_CLIENT_SECRET` env vars.

## Docker

### Pull and run from GitHub Container Registry

```bash
docker run -it --rm \
  -e ZAI_API_KEY=your_api_key_here \
  ghcr.io/huswim/glm-coding-plan-usage:main
```

With Claude usage monitoring:

```bash
docker run -it --rm \
  -e ZAI_API_KEY=your_api_key_here \
  -e CLAUDE_ACCESS_TOKEN=your_claude_token \
  ghcr.io/huswim/glm-coding-plan-usage:main
```

With Copilot usage monitoring:

```bash
docker run -it --rm \
  -e ZAI_API_KEY=your_api_key_here \
  -e GITHUB_COPILOT_TOKEN=your_github_token \
  ghcr.io/huswim/glm-coding-plan-usage:main
```

Optional env overrides:

```bash
docker run -it --rm \
  -e ZAI_API_KEY=your_api_key_here \
  -e POLL_INTERVAL_MS=60000 \
  -e DAYS_BACK=14 \
  ghcr.io/huswim/glm-coding-plan-usage:main
```

> `-it` is required — the dashboard is an interactive terminal UI.

### Build locally

```bash
docker build -t glm-coding-plan-usage .
docker run -it --rm -e ZAI_API_KEY=your_api_key_here glm-coding-plan-usage
```

### CI/CD

GitHub Actions automatically builds and publishes to `ghcr.io` on every push to `main` and on version tags (`v*`). Builds natively for both `linux/amd64` and `linux/arm64`. See [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml).

**Image tags produced:**

| Event | Tag |
|---|---|
| Push to `main` | `main` |
| Tag `v1.2.3` | `1.2.3`, `1.2` |
| Any push | `sha-<short>` |

## Scripts

```bash
pnpm dev      # Run with tsx (no build step)
pnpm build    # Compile to dist/
pnpm start    # Run compiled dist/index.js
```
