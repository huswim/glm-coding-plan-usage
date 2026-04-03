import React from 'react';
import { Box, Text } from 'ink';
import type { DashboardData } from '../types/index.js';

interface StatusBarProps {
  dashboard: DashboardData;
}

function formatTime(d: Date | null): string {
  if (!d) return 'never';
  return d.toLocaleTimeString();
}

export function StatusBar({ dashboard }: StatusBarProps) {
  const panels = [dashboard.modelUsage, dashboard.toolUsage, dashboard.quotaLimit, dashboard.claudeUsage, dashboard.antigravityUsage, dashboard.copilotUsage];
  const anyLoading = panels.some(p => p.loading);
  const anyError = panels.some(p => p.error !== null);
  const timestamps = panels.map(p => p.lastUpdated).filter((d): d is Date => d !== null);
  const latest =
    timestamps.length > 0
      ? new Date(Math.max(...timestamps.map(d => d.getTime())))
      : null;

  return (
    <Box paddingX={1} gap={2}>
      {anyLoading ? (
        <Text color="yellow">Refreshing...</Text>
      ) : anyError ? (
        <Text color="red">Some panels have errors</Text>
      ) : (
        <Text color="green">All OK</Text>
      )}
      <Text dimColor>Last updated: {formatTime(latest)}</Text>
    </Box>
  );
}
