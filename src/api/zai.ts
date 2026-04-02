import axios, { AxiosInstance, AxiosError } from 'axios';
import type { ModelUsageData, ToolUsageData, QuotaLimitData } from '../types/index.js';

const ENDPOINTS = {
  modelUsage: 'https://api.z.ai/api/monitor/usage/model-usage',
  toolUsage: 'https://api.z.ai/api/monitor/usage/tool-usage',
  quotaLimit: 'https://api.z.ai/api/monitor/usage/quota/limit',
} as const;

interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T;
  success: boolean;
}

/** Format a Date as "yyyy-MM-dd HH:mm:ss" (required by the API) */
function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function createHttpClient(apiKey: string): AxiosInstance {
  return axios.create({
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  });
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    if (err.response?.status === 401) return 'Unauthorized — check ZAI_API_KEY';
    if (err.response?.status === 403) return 'Forbidden — insufficient permissions';
    if (err.response?.status === 429) return 'Rate limited by API';
    const msg = (err.response?.data as Record<string, unknown>)?.msg;
    if (msg) return String(msg);
    if (err.code === 'ECONNREFUSED') return 'Connection refused';
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') return 'Request timed out';
    return err.message;
  }
  return String(err);
}

export interface ZaiApiClient {
  fetchModelUsage(daysBack: number): Promise<ModelUsageData>;
  fetchToolUsage(daysBack: number): Promise<ToolUsageData>;
  fetchQuotaLimit(): Promise<QuotaLimitData>;
}

export function createZaiClient(apiKey: string): ZaiApiClient {
  const client = createHttpClient(apiKey);

  async function fetchJson<T>(url: string, params?: Record<string, string>): Promise<T> {
    try {
      const res = await client.get<ApiEnvelope<T>>(url, { params });
      if (!res.data.success) {
        throw new Error(res.data.msg || 'API returned success=false');
      }
      return res.data.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  }

  function timeRangeParams(daysBack: number): Record<string, string> {
    const end = new Date();
    const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
    return {
      startTime: formatDateTime(start),
      endTime: formatDateTime(end),
    };
  }

  return {
    fetchModelUsage: (daysBack) =>
      fetchJson<ModelUsageData>(ENDPOINTS.modelUsage, timeRangeParams(daysBack)),
    fetchToolUsage: (daysBack) =>
      fetchJson<ToolUsageData>(ENDPOINTS.toolUsage, timeRangeParams(daysBack)),
    fetchQuotaLimit: () =>
      fetchJson<QuotaLimitData>(ENDPOINTS.quotaLimit),
  };
}
