import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ApiState, ClaudeUsageData } from '../types/index.js';

interface ClaudeUsageProps {
  state: ApiState<ClaudeUsageData>;
}

function usageColor(pct: number | null): string {
  if (pct === null) return 'white';
  if (pct >= 100) return 'red';
  if (pct >= 80) return 'yellow';
  return 'green';
}

function ProgressBar({ pct }: { pct: number | null }) {
  const width = 20;
  const filled = pct !== null ? Math.round((Math.min(pct, 100) / 100) * width) : 0;
  const color = usageColor(pct);
  return (
    <Box>
      <Text color={color as Parameters<typeof Text>[0]['color']}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(width - filled)}</Text>
      <Text dimColor> {pct !== null ? `${pct}%` : 'N/A'}</Text>
    </Box>
  );
}

function formatReset(d: Date | null): string {
  if (!d) return '';
  return `resets ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

export function ClaudeUsagePanel({ state }: ClaudeUsageProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blueBright" paddingX={1} marginBottom={1}>
      <Text bold color="blueBright">
        Claude Usage
        {state.data?.planName && <Text dimColor>  {state.data.planName}</Text>}
      </Text>
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
            <Box flexDirection="column" marginBottom={1}>
              <Box gap={1}>
                <Box width={4}><Text dimColor>5h</Text></Box>
                <ProgressBar pct={state.data.fiveHour} />
              </Box>
              {state.data.fiveHourResetAt && (
                <Text dimColor>{formatReset(state.data.fiveHourResetAt)}</Text>
              )}
            </Box>
            <Box flexDirection="column">
              <Box gap={1}>
                <Box width={4}><Text dimColor>7d</Text></Box>
                <ProgressBar pct={state.data.sevenDay} />
              </Box>
              {state.data.sevenDayResetAt && (
                <Text dimColor>{formatReset(state.data.sevenDayResetAt)}</Text>
              )}
            </Box>
          </Box>
        )}
        {!state.loading && !state.error && !state.data && (
          <Text dimColor>No data</Text>
        )}
      </Box>
    </Box>
  );
}
