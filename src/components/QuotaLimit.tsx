import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ApiState, QuotaLimitData, QuotaLimitItem } from '../types/index.js';

interface QuotaLimitProps {
  state: ApiState<QuotaLimitData>;
}

const UNIT_LABELS: Record<number, string> = {
  1: 'Monthly',
  2: 'Weekly',
  3: 'Daily',
  4: 'Hourly',
  5: 'Per 5 min',
  6: 'Per minute',
};

const TYPE_LABELS: Record<string, string> = {
  TIME_LIMIT: 'Calls',
  TOKENS_LIMIT: 'Tokens',
};

function ProgressBar({ pct }: { pct: number }) {
  const width = 20;
  const filled = Math.round((Math.min(pct, 100) / 100) * width);
  const color = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green';
  return (
    <Box>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(width - filled)}</Text>
      <Text dimColor> {pct}%</Text>
    </Box>
  );
}

function formatReset(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `resets ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function LimitRow({ item }: { item: QuotaLimitItem }) {
  const typeLabel = TYPE_LABELS[item.type] ?? item.type;
  const unitLabel = UNIT_LABELS[item.unit] ?? `unit${item.unit}`;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        <Text bold>{unitLabel}</Text>
        <Text dimColor>{typeLabel}</Text>
        {item.remaining !== undefined && (
          <Text dimColor>({item.remaining.toLocaleString()} left)</Text>
        )}
      </Box>
      <ProgressBar pct={item.percentage} />
      {item.nextResetTime && (
        <Text dimColor>{formatReset(item.nextResetTime)}</Text>
      )}
    </Box>
  );
}

export function QuotaLimitPanel({ state }: QuotaLimitProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="magenta" paddingX={1} marginBottom={1}>
      <Text bold color="magenta">GLM Coding Plan
        {state.data && <Text dimColor> {state.data.level}</Text>}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {state.loading && (
          <Box gap={1}>
            <Text color="yellow"><Spinner type="dots" /></Text>
            <Text dimColor>Fetching...</Text>
          </Box>
        )}
        {!state.loading && state.error && (
          <Text color="red">Error: {state.error}</Text>
        )}
        {!state.loading && !state.error && state.data && (
          <Box flexDirection="column">
            {state.data.limits.map((item, i) => (
              <LimitRow key={i} item={item} />
            ))}
          </Box>
        )}
        {!state.loading && !state.error && !state.data && (
          <Text dimColor>No data</Text>
        )}
      </Box>
    </Box>
  );
}
