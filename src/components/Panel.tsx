import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { DataTable } from './DataTable.js';
import type { ApiState } from '../types/index.js';

interface PanelProps {
  title: string;
  color: string;
  state: ApiState<Record<string, unknown>>;
}

export function Panel({ title, color, state }: PanelProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={color} paddingX={1} marginBottom={1}>
      <Text bold color={color as Parameters<typeof Text>[0]['color']}>
        {title}
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
          <DataTable data={state.data} />
        )}
        {!state.loading && !state.error && !state.data && (
          <Text dimColor>No data</Text>
        )}
      </Box>
    </Box>
  );
}
