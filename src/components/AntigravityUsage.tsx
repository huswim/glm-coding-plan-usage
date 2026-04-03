import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ApiState, AntigravityData, AntigravityModelInfo } from '../types/index.js';

interface AntigravityUsageProps {
  state: ApiState<AntigravityData>;
}

function modelColor(model: AntigravityModelInfo): string {
  if (model.isExhausted) return 'red';
  if (model.remainingPercentage !== undefined && model.remainingPercentage < 0.2) return 'yellow';
  return 'green';
}

function ProgressBar({ pct, width = 16 }: { pct: number; width?: number }) {
  const filled = Math.round(Math.min(pct, 1) * width);
  const color = pct <= 0 ? 'red' : pct < 0.2 ? 'yellow' : 'green';
  return (
    <Box>
      <Text color={color as Parameters<typeof Text>[0]['color']}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(width - filled)}</Text>
      <Text dimColor> {Math.round(pct * 100)}%</Text>
    </Box>
  );
}

function ModelRow({ model }: { model: AntigravityModelInfo }) {
  const color = modelColor(model) as Parameters<typeof Text>[0]['color'];
  return (
    <Box flexDirection="column" marginBottom={0}>
      <Box gap={1}>
        <Text color={model.isAutocompleteOnly ? 'gray' : color} dimColor={model.isAutocompleteOnly}>
          {model.label}
        </Text>
        {model.isAutocompleteOnly && <Text dimColor>(autocomplete)</Text>}
      </Box>
      {model.remainingPercentage !== undefined && (
        <ProgressBar pct={model.remainingPercentage} />
      )}
      {model.isExhausted && model.remainingPercentage === undefined && (
        <Text color="red">exhausted</Text>
      )}
    </Box>
  );
}

export function AntigravityUsagePanel({ state }: AntigravityUsageProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
      <Text bold color="cyan">
        Antigravity
        {state.data?.email && <Text dimColor>  {state.data.email}</Text>}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {state.loading && (
          <Box gap={1}>
            <Text color="yellow"><Spinner type="dots" /></Text>
            <Text dimColor>Connecting...</Text>
          </Box>
        )}
        {!state.loading && state.error && (
          <Text color="red">{state.error}</Text>
        )}
        {!state.loading && !state.error && state.data && (
          <Box flexDirection="column">
            {state.data.promptCredits && (
              <Box flexDirection="column" marginBottom={1}>
                <Text dimColor>
                  Credits  {state.data.promptCredits.available.toLocaleString()} / {state.data.promptCredits.monthly.toLocaleString()}
                </Text>
                <ProgressBar pct={state.data.promptCredits.remainingPercentage} />
              </Box>
            )}
            {state.data.models.map((model, i) => (
              <ModelRow key={i} model={model} />
            ))}
            {state.data.models.length === 0 && (
              <Text dimColor>No model data</Text>
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
