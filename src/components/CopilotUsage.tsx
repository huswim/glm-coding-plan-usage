import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ApiState, CopilotUsageData } from '../types/index.js';

interface CopilotUsageProps {
  state: ApiState<CopilotUsageData>;
}

function formatReset(d: Date | null): string {
  if (!d) return '';
  return `resets ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function daysInCurrentMonth(resetDate: Date | null): number {
  if (!resetDate) return 30;
  const reset = new Date(resetDate);
  const start = new Date(reset);
  start.setMonth(start.getMonth() - 1);
  const diffMs = reset.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function ProgressBar({ pct }: { pct: number }) {
  const width = 20;
  const filled = Math.round((Math.min(pct, 100) / 100) * width);
  const color = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green';
  return (
    <Box>
      <Text color={color as Parameters<typeof Text>[0]['color']}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(width - filled)}</Text>
      <Text dimColor> {pct.toFixed(1)}%</Text>
    </Box>
  );
}

export function CopilotUsagePanel({ state }: CopilotUsageProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="greenBright" paddingX={1} marginBottom={1}>
      <Text bold color="greenBright">Copilot Usage</Text>
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
            {state.data.unlimited ? (
              <Text color="green">Unlimited premium requests</Text>
            ) : (
              <>
                <Box gap={1}>
                  <Box width={12}><Text dimColor>Entitlement</Text></Box>
                  <Text>{state.data.entitlement}/mo</Text>
                  <Text dimColor>({(state.data.entitlement / daysInCurrentMonth(state.data.resetDate)).toFixed(1)}/day)</Text>
                </Box>
                <Box gap={1} flexDirection="column">
                  <Box gap={1}>
                    <Box width={12}><Text dimColor>Used</Text></Box>
                    <ProgressBar pct={((state.data.entitlement - state.data.remaining) / state.data.entitlement) * 100} />
                  </Box>
                  <Text dimColor>  remaining: {state.data.remaining}</Text>
                </Box>
                {state.data.resetDate && (
                  <Text dimColor>{formatReset(state.data.resetDate)}</Text>
                )}
              </>
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
