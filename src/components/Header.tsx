import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  pollIntervalMs: number;
  daysBack: number;
  showDetails: boolean;
}

export function Header({ pollIntervalMs, daysBack, showDetails }: HeaderProps) {
  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={2}>
      <Text bold color="cyan">z.ai GLM Usage Monitor</Text>
      <Text dimColor>  last {daysBack}d  ·  refresh every {pollIntervalMs / 1000}s</Text>
      <Text dimColor>  [r] refresh  [d] {showDetails ? 'hide' : 'show'} details  [q] quit</Text>
    </Box>
  );
}
