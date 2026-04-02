export interface TableRow {
  key: string;
  value: string;
}

export function toTableRows(data: Record<string, unknown>): TableRow[] {
  return Object.entries(data).map(([key, value]) => ({
    key,
    value:
      typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value ?? '—'),
  }));
}

export function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}
