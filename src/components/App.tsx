import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, useInput, useApp } from 'ink';
import { createZaiClient } from '../api/zai.js';
import { Header } from './Header.js';
import { ModelUsagePanel } from './ModelUsage.js';
import { ToolUsagePanel } from './ToolUsage.js';
import { QuotaLimitPanel } from './QuotaLimit.js';
import { StatusBar } from './StatusBar.js';
import type { AppConfig, DashboardData, ApiState } from '../types/index.js';

interface AppProps {
  config: AppConfig;
}

function initialState<T>(): ApiState<T> {
  return { data: null, loading: true, error: null, lastUpdated: null };
}

export function App({ config }: AppProps) {
  const { exit } = useApp();
  const client = useMemo(() => createZaiClient(config.apiKey), [config.apiKey]);

  const [dashboard, setDashboard] = useState<DashboardData>({
    modelUsage: initialState(),
    toolUsage: initialState(),
    quotaLimit: initialState(),
  });

  const fetchAll = useCallback(async () => {
    setDashboard(prev => ({
      modelUsage: { ...prev.modelUsage, loading: true, error: null },
      toolUsage: { ...prev.toolUsage, loading: true, error: null },
      quotaLimit: { ...prev.quotaLimit, loading: true, error: null },
    }));

    const [modelResult, toolResult, quotaResult] = await Promise.allSettled([
      client.fetchModelUsage(config.daysBack),
      client.fetchToolUsage(config.daysBack),
      client.fetchQuotaLimit(),
    ]);

    const now = new Date();

    setDashboard({
      modelUsage:
        modelResult.status === 'fulfilled'
          ? { data: modelResult.value, loading: false, error: null, lastUpdated: now }
          : { data: null, loading: false, error: (modelResult.reason as Error).message, lastUpdated: now },
      toolUsage:
        toolResult.status === 'fulfilled'
          ? { data: toolResult.value, loading: false, error: null, lastUpdated: now }
          : { data: null, loading: false, error: (toolResult.reason as Error).message, lastUpdated: now },
      quotaLimit:
        quotaResult.status === 'fulfilled'
          ? { data: quotaResult.value, loading: false, error: null, lastUpdated: now }
          : { data: null, loading: false, error: (quotaResult.reason as Error).message, lastUpdated: now },
    });
  }, [client, config.daysBack]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, config.pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchAll, config.pollIntervalMs]);

  useInput((input, key) => {
    if (input === 'q' || key.escape) exit();
    if (input === 'r') fetchAll();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header pollIntervalMs={config.pollIntervalMs} daysBack={config.daysBack} />
      <Box flexDirection="row" marginTop={1} gap={2}>
        <Box flexDirection="column" flexGrow={1}>
          <ModelUsagePanel state={dashboard.modelUsage} daysBack={config.daysBack} />
          <ToolUsagePanel state={dashboard.toolUsage} daysBack={config.daysBack} />
        </Box>
        <Box flexDirection="column" minWidth={32}>
          <QuotaLimitPanel state={dashboard.quotaLimit} />
        </Box>
      </Box>
      <StatusBar dashboard={dashboard} />
    </Box>
  );
}
