import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { CopilotUsageData } from '../types/index.js';

export function getCopilotToken(): string | null {
  const envToken = process.env['GITHUB_COPILOT_TOKEN'];
  if (envToken) return envToken;

  try {
    const authPath = join(homedir(), '.local', 'share', 'opencode', 'auth.json');
    const raw = readFileSync(authPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const ghCopilot = parsed['github-copilot'] as Record<string, unknown> | undefined;
    if (!ghCopilot) return null;
    const refresh = ghCopilot['refresh'] as string | undefined;
    if (refresh) return refresh;
    const access = ghCopilot['access'] as string | undefined;
    if (access) return access;
  } catch {
    // fall through
  }

  try {
    const output = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' });
    const trimmed = output.trim();
    if (trimmed) return trimmed;
  } catch {
    // fall through
  }

  return null;
}

const COPILOT_HEADERS = {
  'User-Agent': 'GitHubCopilotChat/0.35.0',
  'Editor-Version': 'vscode/1.107.0',
  'Editor-Plugin-Version': 'copilot-chat/0.35.0',
  'Copilot-Integration-Id': 'vscode-chat',
  'Accept': 'application/json',
};

async function exchangeToken(githubToken: string): Promise<string> {
  const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      ...COPILOT_HEADERS,
    },
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  return data['token'] as string;
}

export async function fetchCopilotUsage(token: string): Promise<CopilotUsageData> {
  let copilotToken: string;
  try {
    copilotToken = await exchangeToken(token);
  } catch {
    copilotToken = token;
  }

  const response = await fetch('https://api.github.com/copilot_internal/user', {
    headers: {
      Authorization: `Bearer ${copilotToken}`,
      ...COPILOT_HEADERS,
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const snapshots = data['quota_snapshots'] as Record<string, unknown> | undefined;
  const premium = snapshots?.['premium_interactions'] as Record<string, unknown> | undefined;

  if (!premium) {
    throw new Error('Response missing quota_snapshots.premium_interactions');
  }

  const entitlement = premium['entitlement'] as number;
  const remaining = premium['remaining'] as number;
  const unlimited = premium['unlimited'] as boolean;
  const resetDateStr = data['quota_reset_date'] as string | undefined;

  return {
    entitlement,
    remaining,
    unlimited,
    resetDate: resetDateStr ? new Date(resetDateStr) : null,
  };
}
