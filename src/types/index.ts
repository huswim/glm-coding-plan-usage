export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// model-usage response
export interface ModelTotalUsage {
  totalModelCallCount: number;
  totalTokensUsage: number;
}
export interface ModelUsageData {
  x_time: string[];
  modelCallCount: (number | null)[];
  tokensUsage: (number | null)[];
  totalUsage: ModelTotalUsage;
}

// tool-usage response
export interface ToolTotalUsage {
  totalNetworkSearchCount: number;
  totalWebReadMcpCount: number;
  totalZreadMcpCount: number;
  totalSearchMcpCount: number;
  toolDetails: unknown[];
}
export interface ToolUsageData {
  x_time: string[];
  networkSearchCount: (number | null)[];
  webReadMcpCount: (number | null)[];
  zreadMcpCount: (number | null)[];
  totalUsage: ToolTotalUsage;
}

// quota/limit response
export interface QuotaLimitItem {
  type: string;
  unit: number;
  number: number;
  usage?: number;
  currentValue?: number;
  remaining?: number;
  percentage: number;
  nextResetTime?: number;
  usageDetails?: { modelCode: string; usage: number }[];
}
export interface QuotaLimitData {
  limits: QuotaLimitItem[];
  level: string;
}

// Claude usage response
export interface ClaudeUsageData {
  planName: string | null;
  fiveHour: number | null;      // 0-100 %
  sevenDay: number | null;      // 0-100 %
  fiveHourResetAt: Date | null;
  sevenDayResetAt: Date | null;
}

// Gemini CLI usage (cloudcode-pa quota API)
export interface GeminiModelQuota {
  modelId: string;
  remainingAmount: string | null;  // raw string from API (e.g. "1000")
  remainingFraction: number;       // 0-1 fraction
  tokenType: string | null;
  resetTime: string | null;
}

export interface GeminiUsageData {
  authType: 'oauth' | 'api-key' | 'none';
  pooledResetTime: string | null;
  models: GeminiModelQuota[];
}

// GitHub Copilot usage (copilot_internal API)
export interface CopilotUsageData {
  entitlement: number;
  remaining: number;
  unlimited: boolean;
  resetDate: Date | null;
}

// Antigravity usage (local Connect API)
export interface AntigravityModelInfo {
  label: string;
  remainingPercentage?: number;
  isExhausted: boolean;
  resetTime?: string;
  isAutocompleteOnly?: boolean;
}

export interface AntigravityData {
  email?: string;
  promptCredits?: {
    available: number;
    monthly: number;
    usedPercentage: number;
    remainingPercentage: number;
  };
  models: AntigravityModelInfo[];
}

export interface DashboardData {
  modelUsage: ApiState<ModelUsageData>;
  toolUsage: ApiState<ToolUsageData>;
  quotaLimit: ApiState<QuotaLimitData>;
  claudeUsage: ApiState<ClaudeUsageData>;
  antigravityUsage: ApiState<AntigravityData>;
  copilotUsage: ApiState<CopilotUsageData>;
  geminiUsage: ApiState<GeminiUsageData>;
}

export interface AppConfig {
  apiKey: string;
  pollIntervalMs: number;
  daysBack: number;
}
