import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { GeminiUsageData, GeminiModelQuota } from '../types/index.js';

const OAUTH_CLIENT_ID = process.env['GEMINI_OAUTH_CLIENT_ID'];
const OAUTH_CLIENT_SECRET = process.env['GEMINI_OAUTH_CLIENT_SECRET'];
const BASE_URL = 'https://cloudcode-pa.googleapis.com/v1internal';

let cachedProjectId: string | null = null;

function getGeminiCredentials(): { accessToken: string; refreshToken: string } | null {
  if (process.platform === 'darwin') {
    try {
      const raw = execFileSync(
        '/usr/bin/security',
        ['find-generic-password', '-s', 'gemini-cli-oauth', '-a', 'main-account', '-w'],
        { encoding: 'utf8' },
      );
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const accessToken = parsed['access_token'] as string | undefined;
      const refreshToken = parsed['refresh_token'] as string | undefined;
      if (accessToken && refreshToken) {
        return { accessToken, refreshToken };
      }
    } catch {
      // fall through to file-based fallback
    }
  }

  try {
    const raw = readFileSync(join(homedir(), '.gemini', 'oauth_creds.json'), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const accessToken = parsed['access_token'] as string | undefined;
    const refreshToken = parsed['refresh_token'] as string | undefined;
    if (accessToken && refreshToken) {
      return { accessToken, refreshToken };
    }
  } catch {
    // fall through
  }

  return null;
}

export function getGeminiToken(): string | null {
  const envToken = process.env['GEMINI_OAUTH_TOKEN'];
  if (envToken) return envToken;

  const creds = getGeminiCredentials();
  if (creds) return creds.accessToken;

  return null;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
    throw new Error('Token refresh requires GEMINI_OAUTH_CLIENT_ID and GEMINI_OAUTH_CLIENT_SECRET env vars');
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(OAUTH_CLIENT_ID)}&client_secret=${encodeURIComponent(OAUTH_CLIENT_SECRET)}`,
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return data['access_token'] as string;
}

async function resolveProjectId(accessToken: string): Promise<string> {
  const envProject = process.env['GOOGLE_CLOUD_PROJECT'] || process.env['GOOGLE_CLOUD_PROJECT_ID'];
  if (envProject) return envProject;

  if (cachedProjectId) return cachedProjectId;

  const response = await fetch(`${BASE_URL}:loadCodeAssist`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metadata: {
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`loadCodeAssist failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const project = data['cloudaicompanionProject'] as string | undefined;

  if (!project) {
    throw new Error('No project ID returned by server — ensure Gemini CLI is set up (run `gemini` to complete onboarding)');
  }

  cachedProjectId = project;
  return project;
}

export async function fetchGeminiUsage(token: string): Promise<GeminiUsageData> {
  let accessToken = token;

  // resolveProjectId calls loadCodeAssist which can 401 on an expired token;
  // try refreshing once before giving up.
  let project: string;
  try {
    project = await resolveProjectId(accessToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401')) {
      const creds = getGeminiCredentials();
      if (creds?.refreshToken) {
        accessToken = await refreshAccessToken(creds.refreshToken);
        cachedProjectId = null;
        project = await resolveProjectId(accessToken);
      } else {
        throw new Error('Authentication failed — token expired and refresh unavailable');
      }
    } else {
      throw err;
    }
  }

  async function doQuotaFetch(authToken: string): Promise<Response> {
    return fetch(`${BASE_URL}:retrieveUserQuota`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project }),
    });
  }

  let response = await doQuotaFetch(accessToken);

  // Retry with refreshed token on 401
  if (response.status === 401) {
    const creds = getGeminiCredentials();
    if (creds?.refreshToken) {
      accessToken = await refreshAccessToken(creds.refreshToken);
      cachedProjectId = null;
      const retryProject = await resolveProjectId(accessToken);
      response = await fetch(`${BASE_URL}:retrieveUserQuota`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ project: retryProject }),
      });
    }
    if (!response.ok) {
      throw new Error('Authentication failed — token expired and refresh unavailable');
    }
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 403 || response.status === 404) {
      cachedProjectId = null;
    }
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
const buckets = (data['buckets'] ?? []) as Array<Record<string, unknown>>;

  const models: GeminiModelQuota[] = buckets.map((bucket, i) => {
    const modelId =
      (bucket['modelId'] as string | undefined) ??
      (bucket['tokenType'] as string | undefined) ??
      `model-${i}`;
    const remainingAmount = (bucket['remainingAmount'] as string | undefined) ?? null;
    const remainingFraction = (bucket['remainingFraction'] as number | undefined) ?? 0;
    const tokenType = (bucket['tokenType'] as string | undefined) ?? null;
    const resetTime = (bucket['resetTime'] as string | undefined) ?? null;

    return { modelId, remainingAmount, remainingFraction, tokenType, resetTime };
  });

  const pooledResetTime =
    models
      .map((m) => m.resetTime)
      .filter((t): t is string => t !== null)
      .sort()[0] ?? null;

  return {
    authType: 'oauth' as const,
    pooledResetTime,
    models,
  };
}
