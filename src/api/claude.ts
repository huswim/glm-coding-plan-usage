import { execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ClaudeUsageData } from '../types/index.js';

export interface ClaudeCredentials {
  accessToken: string;
  refreshToken?: string;
}

let sessionCreds: ClaudeCredentials | null = null;

/**
 * Resolve Claude OAuth token.
 * Priority: Session (in-memory) → CLAUDE_ACCESS_TOKEN env var → macOS Keychain → Linux/Windows config → null
 */
export function getClaudeAccessToken(): string | null {
  const creds = getClaudeCredentials();
  return creds?.accessToken ?? null;
}

export function getClaudeCredentials(): ClaudeCredentials | null {
  if (sessionCreds) return sessionCreds;

  const envToken = process.env['CLAUDE_ACCESS_TOKEN'];
  if (envToken) return { accessToken: envToken };

  // macOS Keychain
  if (process.platform === 'darwin') {
    try {
      const output = execFileSync('/usr/bin/security', [
        'find-generic-password',
        '-s', 'Claude Code-credentials',
        '-w',
      ], { encoding: 'utf8' });

      const trimmed = output.trim();
      if (trimmed) {
        const data = JSON.parse(trimmed);
        const oauth = data.claudeAiOauth;
        if (oauth?.accessToken) {
          return {
            accessToken: oauth.accessToken,
            refreshToken: oauth.refreshToken || undefined,
          };
        }
      }
    } catch {
      // fall through
    }
  }

  // Linux/Windows/macOS file-based fallback
  const configDir = process.env['CLAUDE_CONFIG_DIR'] || join(homedir(), '.claude');
  const credsPath = join(configDir, '.credentials.json');
  if (existsSync(credsPath)) {
    try {
      const raw = readFileSync(credsPath, 'utf8');
      const data = JSON.parse(raw);
      // claude-code typically stores credentials under 'claudeAiOauth' or top-level keys
      const oauth = data.claudeAiOauth || data;
      const accessToken = oauth.accessToken || oauth.access_token;
      const refreshToken = oauth.refreshToken || oauth.refresh_token;
      if (accessToken) {
        return {
          accessToken: accessToken,
          refreshToken: refreshToken || undefined,
        };
      }
    } catch {
      // fall through
    }
  }

  return null;
}

async function refreshClaudeToken(refreshToken: string): Promise<ClaudeCredentials> {
  const response = await fetch('https://api.anthropic.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=claude-code`,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const accessToken = data['access_token'] as string | undefined;
  const newRefreshToken = (data['refresh_token'] as string | undefined) || refreshToken;

  if (!accessToken) {
    throw new Error('Refresh response missing access_token');
  }

  const newCreds = { accessToken, refreshToken: newRefreshToken };
  sessionCreds = newCreds;
  return newCreds;
}

export async function fetchClaudeUsage(accessToken: string): Promise<ClaudeUsageData> {
  async function doFetch(token: string) {
    return fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'claude-code/2.1',
      },
    });
  }

  let response = await doFetch(accessToken);

  if (response.status === 401) {
    const creds = getClaudeCredentials();
    if (creds?.refreshToken) {
      try {
        const newCreds = await refreshClaudeToken(creds.refreshToken);
        response = await doFetch(newCreds.accessToken);
      } catch (err) {
        throw new Error(`Authentication failed - token expired and refresh failed (run 'claude login' to re-authenticate). ${err instanceof Error ? err.message : ''}`);
      }
    } else {
      throw new Error(`Authentication failed - token expired (try running 'claude login' to re-authenticate)`);
    }
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;

  type Window = { utilization?: number; resets_at?: string };
  const fiveHour = data['five_hour'] as Window | undefined;
  const sevenDay = data['seven_day'] as Window | undefined;

  return {
    planName: (data['plan_name'] as string | undefined) ?? null,
    fiveHour: fiveHour?.utilization !== undefined ? Math.round(fiveHour.utilization) : null,
    sevenDay: sevenDay?.utilization !== undefined ? Math.round(sevenDay.utilization) : null,
    fiveHourResetAt: fiveHour?.resets_at ? new Date(fiveHour.resets_at) : null,
    sevenDayResetAt: sevenDay?.resets_at ? new Date(sevenDay.resets_at) : null,
  };
}
