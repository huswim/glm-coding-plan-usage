import React from 'react';
import { Box, Text } from 'ink';
import { toTableRows, isRecord } from '../utils/flatten.js';

interface DataTableProps {
  data: unknown;
}

export function DataTable({ data }: DataTableProps) {
  if (Array.isArray(data)) {
    if (data.length === 0) return <Text dimColor>Empty array</Text>;
    // Array of objects: render each as a row
    const keys = Object.keys(data[0] as Record<string, unknown>);
    return (
      <Box flexDirection="column">
        <Box>
          {keys.map(k => (
            <Box key={k} width={20}>
              <Text bold color="cyan">{k}</Text>
            </Box>
          ))}
        </Box>
        {(data as Record<string, unknown>[]).map((row, i) => (
          <Box key={i}>
            {keys.map(k => (
              <Box key={k} width={20}>
                <Text>{String(row[k] ?? '—')}</Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    );
  }

  if (isRecord(data)) {
    const rows = toTableRows(data);
    if (rows.length === 0) return <Text dimColor>Empty object</Text>;
    return (
      <Box flexDirection="column">
        {rows.map(({ key, value }) => (
          <Box key={key} gap={1}>
            <Box width={24}>
              <Text color="cyan">{key}</Text>
            </Box>
            <Text wrap="truncate-end">{value}</Text>
          </Box>
        ))}
      </Box>
    );
  }

  return <Text>{String(data)}</Text>;
}
