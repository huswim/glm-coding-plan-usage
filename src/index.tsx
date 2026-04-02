import 'dotenv/config';
import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';
import type { AppConfig } from './types/index.js';

const apiKey = process.env['ZAI_API_KEY'];

if (!apiKey) {
  console.error('Error: ZAI_API_KEY environment variable is not set.');
  console.error('Copy .env.example to .env and add your API key.');
  process.exit(1);
}

const config: AppConfig = {
  apiKey,
  pollIntervalMs: parseInt(process.env['POLL_INTERVAL_MS'] ?? '30000', 10),
  daysBack: parseInt(process.env['DAYS_BACK'] ?? '7', 10),
};

render(<App config={config} />);
