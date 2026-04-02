import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ApiState, ToolUsageData } from '../types/index.js';

interface ToolUsageProps {
  state: ApiState<ToolUsageData>;
  daysBack: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function ToolUsagePanel({ state, daysBack }: ToolUsageProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1} marginBottom={1}>
      <Text bold color="yellow">Tool Usage  <Text dimColor>(last {daysBack}d)</Text></Text>
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
            {[
              ['Network Search', state.data.totalUsage.totalNetworkSearchCount],
              ['Web Read MCP',   state.data.totalUsage.totalWebReadMcpCount],
              ['Zread MCP',      state.data.totalUsage.totalZreadMcpCount],
              ['Search MCP',     state.data.totalUsage.totalSearchMcpCount],
            ].map(([label, value]) => (
              <Box key={String(label)} gap={1}>
                <Box width={18}><Text dimColor>{label}</Text></Box>
                <Text bold color="yellowBright">{formatNumber(Number(value))}</Text>
              </Box>
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
