import { detectAntigravityProcess } from './antigravity/process-detector.js';
import { discoverPorts } from './antigravity/port-detective.js';
import { probeForConnectAPI } from './antigravity/port-prober.js';
import { ConnectClient } from './antigravity/connect-client.js';
import { parseLocalQuotaSnapshot } from './antigravity/local-parser.js';
import type { AntigravityData } from '../types/index.js';

export async function fetchAntigravityUsage(): Promise<AntigravityData> {
  const processInfo = await detectAntigravityProcess();
  if (!processInfo) throw new Error('Antigravity not running');

  // Prefer https_server_port (Connect RPC), then extension_server_port, then discover
  const ports = processInfo.httpsServerPort
    ? [processInfo.httpsServerPort]
    : processInfo.extensionServerPort
      ? [processInfo.extensionServerPort]
      : await discoverPorts(processInfo.pid);

  if (ports.length === 0) throw new Error('No ports found for Antigravity process');

  const probe = await probeForConnectAPI(ports, processInfo.csrfToken);
  if (!probe) throw new Error('Connect API not reachable');

  const client = new ConnectClient(probe.baseUrl, processInfo.csrfToken);
  const userStatus = await client.getUserStatus();
  const snapshot = parseLocalQuotaSnapshot(userStatus);

  return {
    email: snapshot.email,
    promptCredits: snapshot.promptCredits,
    models: snapshot.models.map(m => ({
      label: m.label,
      remainingPercentage: m.remainingPercentage,
      isExhausted: m.isExhausted,
      resetTime: m.resetTime,
      isAutocompleteOnly: m.isAutocompleteOnly,
    })),
  };
}
