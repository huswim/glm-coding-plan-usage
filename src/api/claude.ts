import { execFileSync } from 'child_process';
import type { ClaudeUsageData } from '../types/index.js';

/**
 * Resolve Claude OAuth token.
 * Priority: CLAUDE_ACCESS_TOKEN env var → macOS Keychain → null
 */
export function getClaudeAccessToken(): string | null {
  const envToken = process.env['CLAUDE_ACCESS_TOKEN'];
  if (envToken) return envToken;

  if (process.platform !== 'darwin') return null;

  try {
    const output = execFileSync('/usr/bin/security', [
      'find-generic-password',
      '-s', 'Claude Code-credentials',
      '-w',
    ], { encoding: 'utf8' });

    const trimmed = output.trim();
    if (!trimmed) return null;

    const data = JSON.parse(trimmed);
    return data.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function fetchClaudeUsage(accessToken: string): Promise<ClaudeUsageData> {
  const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'User-Agent': 'claude-code/2.1',
    },
  });

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
