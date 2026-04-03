import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ApiState, GeminiUsageData, GeminiModelQuota } from '../types/index.js';

function ProgressBar({ pct, width = 16 }: { pct: number; width?: number }) {
  const filled = Math.round(Math.min(Math.max(pct, 0), 1) * width);
  const color = pct <= 0 ? 'red' : pct < 0.2 ? 'yellow' : 'green';
  return (
    <Box>
      <Text color={color as Parameters<typeof Text>[0]['color']}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(width - filled)}</Text>
      <Text dimColor> {Math.round(pct * 100)}%</Text>
    </Box>
  );
}

function ModelRow({ quota }: { quota: GeminiModelQuota }) {
  const pct = quota.remainingFraction;
  const color = pct <= 0 ? 'red' : pct < 0.2 ? 'yellow' : 'green';
  const label = quota.modelId;
  const amountStr = quota.remainingAmount != null ? ` ${quota.remainingAmount} left` : '';
  return (
    <Box flexDirection="column" marginBottom={0}>
      <Box gap={1}>
        <Text color={color as Parameters<typeof Text>[0]['color']}>{label}</Text>
        <Text dimColor>{amountStr}</Text>
      </Box>
      <ProgressBar pct={pct} />
    </Box>
  );
}

function formatResetTime(isoString: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return `resets ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  } catch {
    return '';
  }
}

export function GeminiUsagePanel({ state }: { state: ApiState<GeminiUsageData> }) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="magenta" paddingX={1} marginBottom={1}>
      <Text bold color="magenta">Gemini CLI</Text>
      <Box marginTop={1} flexDirection="column">
        {state.loading && (
          <Box gap={1}>
            <Text color="yellow"><Spinner type="dots" /></Text>
            <Text dimColor>Fetching...</Text>
          </Box>
        )}
        {!state.loading && state.error && (
          <Text color="red">{state.error}</Text>
        )}
        {!state.loading && !state.error && state.data && (
          <Box flexDirection="column">
            {state.data.models.length === 0 && (
              <Text dimColor>No quota data</Text>
            )}
            {state.data.models.map((quota, i) => (
              <ModelRow key={`${quota.modelId}-${i}`} quota={quota} />
            ))}
            {state.data.pooledResetTime && (
              <Text dimColor>{formatResetTime(state.data.pooledResetTime)}</Text>
            )}
          </Box>
        )}
        {!state.loading && !state.error && !state.data && (
          <Text dimColor>No data</Text>
        )}
      </Box>
    </Box>
  );
}
