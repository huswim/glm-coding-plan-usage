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
}

export interface AppConfig {
  apiKey: string;
  pollIntervalMs: number;
  daysBack: number;
}
