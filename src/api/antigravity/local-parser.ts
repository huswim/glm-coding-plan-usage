import type { ConnectUserStatus } from './connect-client.js';

interface PromptCreditsInfo {
  available: number;
  monthly: number;
  usedPercentage: number;
  remainingPercentage: number;
}

interface ModelQuotaInfo {
  label: string;
  modelId: string;
  remainingPercentage?: number;
  isExhausted: boolean;
  resetTime?: string;
  timeUntilResetMs?: number;
  isAutocompleteOnly?: boolean;
}

export interface QuotaSnapshot {
  timestamp: string;
  method: 'local';
  email?: string;
  promptCredits?: PromptCreditsInfo;
  models: ModelQuotaInfo[];
}

export function parseLocalQuotaSnapshot(userStatus: ConnectUserStatus): QuotaSnapshot {
  const snapshot: QuotaSnapshot = {
    timestamp: new Date().toISOString(),
    method: 'local',
    email: userStatus.email,
    models: [],
  };

  if (userStatus.quota?.promptCredits) {
    snapshot.promptCredits = parsePromptCredits(userStatus.quota.promptCredits);
  }

  if (userStatus.quota?.models) {
    snapshot.models = userStatus.quota.models.map(parseModelQuota);
  }

  return snapshot;
}

function parsePromptCredits(
  credits: NonNullable<ConnectUserStatus['quota']>['promptCredits']
): PromptCreditsInfo | undefined {
  if (!credits) return undefined;
  const limit = credits.limit ?? 0;
  const remaining = credits.remaining ?? limit;
  const used = credits.used ?? (limit - remaining);
  if (limit === 0) return undefined;
  return {
    available: remaining,
    monthly: limit,
    usedPercentage: limit > 0 ? used / limit : 0,
    remainingPercentage: limit > 0 ? remaining / limit : 1,
  };
}

function parseModelQuota(
  model: NonNullable<NonNullable<ConnectUserStatus['quota']>['models']>[number]
): ModelQuotaInfo {
  const quota = model.quota;
  return {
    label: model.label || model.displayName || model.modelId,
    modelId: model.modelId,
    remainingPercentage: quota?.remainingPercentage,
    isExhausted: model.isExhausted ?? (quota?.remainingPercentage === 0),
    resetTime: quota?.resetTime,
    timeUntilResetMs: quota?.timeUntilResetMs,
    isAutocompleteOnly:
      model.modelId.includes('gemini-2.5') ||
      (model.label || '').includes('Gemini 2.5') ||
      (model.displayName || '').includes('Gemini 2.5'),
  };
}
