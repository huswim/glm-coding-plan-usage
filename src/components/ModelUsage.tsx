import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ApiState, ModelUsageData } from '../types/index.js';

interface ModelUsageProps {
  state: ApiState<ModelUsageData>;
  daysBack: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function ModelUsagePanel({ state, daysBack }: ModelUsageProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={1} marginBottom={1}>
      <Text bold color="green">Model Usage  <Text dimColor>(last {daysBack}d)</Text></Text>
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
          <Box flexDirection="column" gap={0}>
            <Box gap={2}>
              <Box flexDirection="column">
                <Text dimColor>Total Calls</Text>
                <Text bold color="greenBright">{formatNumber(state.data.totalUsage.totalModelCallCount)}</Text>
              </Box>
              <Box flexDirection="column">
                <Text dimColor>Total Tokens</Text>
                <Text bold color="greenBright">{formatNumber(state.data.totalUsage.totalTokensUsage)}</Text>
              </Box>
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
