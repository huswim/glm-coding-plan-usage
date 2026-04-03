import https from 'https';
import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { AntigravityData } from '../types/index.js';

const execAsync = promisify(exec);

// --- antigravity.ts (main) ---
export async function fetchAntigravityUsage(): Promise<AntigravityData> {
  const processInfo = await detectAntigravityProcess();
  if (!processInfo) throw new Error('Antigravity not running');

  // Collect all possible ports to probe
  const portSet = new Set<number>();
  if (processInfo.httpsServerPort) portSet.add(processInfo.httpsServerPort);
  if (processInfo.extensionServerPort) portSet.add(processInfo.extensionServerPort);
  
  try {
    const discovered = await discoverPorts(processInfo.pid);
    discovered.forEach(p => portSet.add(p));
  } catch (err) {
    console.error(`Failed to discover ports for Antigravity pid ${processInfo.pid}:`, err);
  }

  const ports = Array.from(portSet);
  if (ports.length === 0) throw new Error('No ports found for Antigravity process');

  const probe = await probeForConnectAPI(ports, processInfo.csrfToken);
  if (!probe) {
    throw new Error(`Connect API not reachable on ports: ${ports.join(', ')}`);
  }

  const client = new ConnectClient(probe.baseUrl, processInfo.csrfToken);
  const userStatus = await client.getUserStatus();
  const snapshot = parseLocalQuotaSnapshot(userStatus);

  return {
    email: snapshot.email,
    models: snapshot.models.map(m => ({
      label: m.label,
      remainingPercentage: m.remainingPercentage,
      isExhausted: m.isExhausted,
      resetTime: m.resetTime,
      isAutocompleteOnly: m.isAutocompleteOnly,
    })),
  };
}

// --- process-detector.ts ---
export interface AntigravityProcessInfo {
  pid: number;
  csrfToken?: string;
  httpsServerPort?: number;
  extensionServerPort?: number;
  commandLine: string;
}

export async function detectAntigravityProcess(): Promise<AntigravityProcessInfo | null> {
  if (process.platform === 'win32') {
    return detectOnWindows();
  }
  return detectOnUnix();
}

async function detectOnUnix(): Promise<AntigravityProcessInfo | null> {
  try {
    const { stdout } = await execAsync('ps aux');
    for (const line of stdout.split('\n')) {
      const lower = line.toLowerCase();
      if (!lower.includes('antigravity')) continue;
      if (lower.includes('server installation script')) continue;
      const hasServerSignal =
        line.includes('language-server') ||
        line.includes('lsp') ||
        line.includes('--csrf_token') ||
        line.includes('--extension_server_port') ||
        line.includes('exa.language_server_pb');
      if (!hasServerSignal) continue;
      const processInfo = parseUnixProcessLine(line);
      if (processInfo) return processInfo;
    }
    return null;
  } catch {
    return null;
  }
}

function parseUnixProcessLine(line: string): AntigravityProcessInfo | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 11) return null;
  const pid = parseInt(parts[1], 10);
  if (isNaN(pid)) return null;
  const commandLine = parts.slice(10).join(' ');
  return {
    pid,
    csrfToken: extractArgument(commandLine, '--csrf_token') ?? undefined,
    httpsServerPort: parsePortValue(extractArgument(commandLine, '--https_server_port')),
    extensionServerPort: parsePortValue(extractArgument(commandLine, '--extension_server_port')),
    commandLine,
  };
}

async function detectOnWindows(): Promise<AntigravityProcessInfo | null> {
  try {
    const { stdout } = await execAsync(
      'wmic process where "name like \'%antigravity%\' or commandline like \'%antigravity%\'" get processid,commandline /format:csv',
      { maxBuffer: 10 * 1024 * 1024 }
    );
    const candidates: AntigravityProcessInfo[] = [];
    for (const line of stdout.split('\n').filter(l => l.trim() && !l.includes('Node,CommandLine,ProcessId'))) {
      const parts = line.split(',');
      if (parts.length >= 3) {
        const commandLine = parts.slice(1, -1).join(',');
        const pid = parseInt(parts[parts.length - 1].trim(), 10);
        if (!isNaN(pid) && commandLine.toLowerCase().includes('antigravity')) {
          candidates.push({
            pid,
            csrfToken: extractArgument(commandLine, '--csrf_token') ?? undefined,
            httpsServerPort: parsePortValue(extractArgument(commandLine, '--https_server_port')),
            extensionServerPort: parsePortValue(extractArgument(commandLine, '--extension_server_port')),
            commandLine,
          });
        }
      }
    }
    return selectBestWindowsCandidate(candidates) ?? await detectOnWindowsPowerShell();
  } catch {
    return detectOnWindowsPowerShell();
  }
}

async function detectOnWindowsPowerShell(): Promise<AntigravityProcessInfo | null> {
  try {
    const { stdout } = await execAsync(
      'powershell -Command "Get-Process | Where-Object { $_.ProcessName -like \'*antigravity*\' } | Select-Object Id, ProcessName | ConvertTo-Json"'
    );
    if (!stdout.trim()) return null;
    const processes = JSON.parse(stdout);
    const list = Array.isArray(processes) ? processes : [processes];
    const candidates: AntigravityProcessInfo[] = [];
    for (const proc of list) {
      if (!proc.Id) continue;
      const { stdout: cmdLine } = await execAsync(
        `powershell -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId = ${proc.Id}').CommandLine"`
      );
      const commandLine = cmdLine.trim();
      if (!commandLine.toLowerCase().includes('antigravity')) continue;
      candidates.push({
        pid: proc.Id,
        csrfToken: extractArgument(commandLine, '--csrf_token') ?? undefined,
        httpsServerPort: parsePortValue(extractArgument(commandLine, '--https_server_port')),
        extensionServerPort: parsePortValue(extractArgument(commandLine, '--extension_server_port')),
        commandLine,
      });
    }
    return selectBestWindowsCandidate(candidates);
  } catch {
    return null;
  }
}

function parsePortValue(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const v = parseInt(raw, 10);
  return isNaN(v) ? undefined : v;
}

function scoreWindowsCandidate(c: AntigravityProcessInfo): number {
  const lower = c.commandLine.toLowerCase();
  let score = 0;
  if (lower.includes('antigravity')) score += 1;
  if (lower.includes('lsp')) score += 5;
  if (c.extensionServerPort) score += 10;
  if (c.csrfToken) score += 20;
  if (lower.includes('language_server') || lower.includes('language-server') || lower.includes('exa.language_server_pb')) score += 50;
  return score;
}

function selectBestWindowsCandidate(candidates: AntigravityProcessInfo[]): AntigravityProcessInfo | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => scoreWindowsCandidate(c) > scoreWindowsCandidate(best) ? c : best);
}

function extractArgument(commandLine: string, argName: string): string | null {
  const eqMatch = commandLine.match(new RegExp(`${argName}=([^\\s"\']+|"[^"]*"|\'[^\']*\')`, 'i'));
  if (eqMatch) return eqMatch[1].replace(/^["\']|["\']$/g, '');
  const spaceMatch = commandLine.match(new RegExp(`${argName}\\s+([^\\s"\']+|"[^"]*"|\'[^\']*\')`, 'i'));
  if (spaceMatch) return spaceMatch[1].replace(/^["\']|["\']$/g, '');
  return null;
}

// --- port-detective.ts ---
export async function discoverPorts(pid: number): Promise<number[]> {
  if (process.platform === 'win32') return discoverPortsOnWindows(pid);
  if (process.platform === 'darwin') return discoverPortsOnMacOS(pid);
  return discoverPortsOnLinux(pid);
}

async function discoverPortsOnMacOS(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(`lsof -nP -iTCP -sTCP:LISTEN -a -p ${pid}`);
    const ports: number[] = [];
    for (const line of stdout.split('\n')) {
      const match = line.match(/:(\d+)\s+\(LISTEN\)/);
      if (match) {
        const port = parseInt(match[1], 10);
        if (!isNaN(port) && !ports.includes(port)) ports.push(port);
      }
    }
    return ports;
  } catch {
    return [];
  }
}

async function discoverPortsOnLinux(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(`ss -tlnp | grep "pid=${pid},"`);
    const ports: number[] = [];
    for (const line of stdout.split('\n')) {
      const match = line.match(/:(\d+)\s/);
      if (match) {
        const port = parseInt(match[1], 10);
        if (!isNaN(port) && !ports.includes(port)) ports.push(port);
      }
    }
    if (ports.length > 0) return ports;
    return discoverPortsOnLinuxNetstat(pid);
  } catch {
    return discoverPortsOnLinuxNetstat(pid);
  }
}

async function discoverPortsOnLinuxNetstat(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(`netstat -tlnp 2>/dev/null | grep "${pid}/"`);
    const ports: number[] = [];
    for (const line of stdout.split('\n')) {
      const match = line.match(/:(\d+)\s/);
      if (match) {
        const port = parseInt(match[1], 10);
        if (!isNaN(port) && !ports.includes(port)) ports.push(port);
      }
    }
    return ports;
  } catch {
    return [];
  }
}

async function discoverPortsOnWindows(pid: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync('netstat -ano');
    const ports: number[] = [];
    for (const line of stdout.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      if (parseInt(parts[parts.length - 1], 10) === pid) {
        const portMatch = parts[1].match(/:(\d+)$/);
        if (portMatch) {
          const port = parseInt(portMatch[1], 10);
          if (!isNaN(port) && !ports.includes(port)) ports.push(port);
        }
      }
    }
    return ports;
  } catch {
    return [];
  }
}

// --- port-prober.ts ---
const CONNECT_RPC_PATH = '/exa.language_server_pb.LanguageServerService/GetUnleashData';
const VALID_CONNECT_STATUSES = new Set([200, 401]);

export interface ProbeResult {
  baseUrl: string;
  protocol: 'https' | 'http';
  port: number;
}

export async function probeForConnectAPI(ports: number[], csrfToken?: string, timeout = 500): Promise<ProbeResult | null> {
  const results = await Promise.allSettled(ports.map(port => probePort(port, csrfToken, timeout)));
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) return result.value;
  }
  return null;
}

async function probePort(port: number, csrfToken?: string, timeout = 500): Promise<ProbeResult | null> {
  return (await probeHttps(port, timeout, csrfToken)) ?? (await probeHttp(port, timeout, csrfToken));
}

function probeHttps(port: number, timeout: number, csrfToken?: string): Promise<ProbeResult | null> {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: '127.0.0.1', port, path: CONNECT_RPC_PATH, method: 'POST',
      timeout, rejectUnauthorized: false,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json', 'Connect-Protocol-Version': '1',
        ...(csrfToken ? { 'X-Codeium-Csrf-Token': csrfToken } : {}),
      },
    }, (res) => {
      res.resume();
      resolve(res.statusCode && VALID_CONNECT_STATUSES.has(res.statusCode)
        ? { baseUrl: `https://127.0.0.1:${port}`, protocol: 'https', port }
        : null);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(JSON.stringify({ wrapper_data: {} }));
    req.end();
  });
}

function probeHttp(port: number, timeout: number, csrfToken?: string): Promise<ProbeResult | null> {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1', port, path: CONNECT_RPC_PATH, method: 'POST',
      timeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json', 'Connect-Protocol-Version': '1',
        ...(csrfToken ? { 'X-Codeium-Csrf-Token': csrfToken } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk.toString(); });
      res.on('end', () => {
        if (data.toLowerCase().includes('client sent an http request to an https server')) return resolve(null);
        resolve(res.statusCode && VALID_CONNECT_STATUSES.has(res.statusCode)
          ? { baseUrl: `http://127.0.0.1:${port}`, protocol: 'http', port }
          : null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(JSON.stringify({ wrapper_data: {} }));
    req.end();
  });
}

// --- connect-client.ts ---
export interface ConnectUserStatus {
  isAuthenticated?: boolean;
  email?: string;
  quota?: {
    promptCredits?: { used?: number; limit?: number; remaining?: number };
    models?: Array<{
      modelId: string;
      displayName?: string;
      label?: string;
      quota?: {
        remaining?: number;
        limit?: number;
        usedPercentage?: number;
        remainingPercentage?: number;
        resetTime?: string;
        timeUntilResetMs?: number;
      };
      isExhausted?: boolean;
    }>;
  };
  raw?: unknown;
}

interface ConnectModelInfo {
  modelId: string;
  displayName?: string;
  label?: string;
  quota?: {
    remaining?: number;
    limit?: number;
    usedPercentage?: number;
    remainingPercentage?: number;
    resetTime?: string;
    timeUntilResetMs?: number;
  };
  isExhausted?: boolean;
}

export class ConnectClient {
  private baseUrl: string;
  private csrfToken: string | undefined;
  private isHttps: boolean;

  constructor(baseUrl: string, csrfToken?: string) {
    this.baseUrl = baseUrl;
    this.csrfToken = csrfToken;
    this.isHttps = baseUrl.startsWith('https://');
  }

  async getUserStatus(): Promise<ConnectUserStatus> {
    const endpoint = '/exa.language_server_pb.LanguageServerService/GetUserStatus';
    try {
      const response = await this.request('POST', endpoint, {
        metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' },
      });
      if (response) return this.parseUserStatus(response);
    } catch (err) {
      throw new Error(`Failed to fetch user status: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    throw new Error('Could not fetch user status from Connect RPC endpoint');
  }

  private request(method: string, path: string, body?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
        ...(this.csrfToken ? { 'X-Codeium-Csrf-Token': this.csrfToken } : {}),
      };
      const options = {
        hostname: url.hostname, port: url.port, path: url.pathname,
        method, headers, timeout: 5000, rejectUnauthorized: false,
      };
      const protocol = this.isHttps ? https : http;
      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); } catch { resolve(data); }
          } else if (res.statusCode === 404) {
            reject(new Error(`Endpoint not found: ${path}`));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  private parseUserStatus(response: unknown): ConnectUserStatus {
    const status: ConnectUserStatus = { raw: response };
    if (typeof response !== 'object' || response === null) return status;
    const data = response as Record<string, unknown>;
    const userStatus = (data['userStatus'] as Record<string, unknown>) || data;
    if ('email' in userStatus && typeof userStatus['email'] === 'string') status.email = userStatus['email'];
    if ('isAuthenticated' in userStatus) status.isAuthenticated = Boolean(userStatus['isAuthenticated']);
    status.quota = this.extractQuota(userStatus);
    return status;
  }

  private extractQuota(data: Record<string, unknown>): ConnectUserStatus['quota'] {
    const quota: ConnectUserStatus['quota'] = {};

    const planStatus = data['planStatus'] as Record<string, unknown> | undefined;
    if (planStatus) {
      const available = planStatus['availablePromptCredits'];
      const planInfo = planStatus['planInfo'] as Record<string, unknown> | undefined;
      const monthly = planInfo?.['monthlyPromptCredits'];
      if (typeof available === 'number' && typeof monthly === 'number') {
        quota.promptCredits = { used: monthly - available, limit: monthly, remaining: available };
      }
    }
    
    const cascadeData = data['cascadeModelConfigData'] as Record<string, unknown> | undefined;
    const clientModelConfigs = cascadeData?.['clientModelConfigs'];
    if (Array.isArray(clientModelConfigs)) {
      quota.models = clientModelConfigs.map(this.parseModel.bind(this));
    }
    return quota;
  }

  private parseModel(model: unknown): ConnectModelInfo {
    if (typeof model !== 'object' || model === null) return { modelId: 'unknown', isExhausted: false };
    const m = model as Record<string, unknown>;
    const modelOrAlias = m['modelOrAlias'] as Record<string, unknown> | undefined;
    const modelId = typeof modelOrAlias?.['model'] === 'string' ? modelOrAlias['model'] : 'unknown';
    const quotaInfo = m['quotaInfo'] as Record<string, unknown> | undefined;
    const remainingFraction = typeof quotaInfo?.['remainingFraction'] === 'number' ? quotaInfo['remainingFraction'] : undefined;
    const resetTime = typeof quotaInfo?.['resetTime'] === 'string' ? quotaInfo['resetTime'] : undefined;
    return {
      modelId,
      displayName: typeof m['label'] === 'string' ? m['label'] : undefined,
      label: typeof m['label'] === 'string' ? m['label'] : undefined,
      quota: {
        usedPercentage: remainingFraction !== undefined ? (1 - remainingFraction) : undefined,
        remainingPercentage: remainingFraction,
        resetTime,
        timeUntilResetMs: resetTime ? this.parseResetTime(resetTime) : undefined,
      },
      isExhausted: remainingFraction === 0,
    };
  }

  private parseResetTime(resetTime: string): number | undefined {
    try {
      const diff = new Date(resetTime).getTime() - Date.now();
      return diff > 0 ? diff : undefined;
    } catch {
      return undefined;
    }
  }
}

// --- local-parser.ts ---
interface PromptCreditsInfo {
  available: number;
  monthly: number;
  usedPercentage: number;
  remainingPercentage: number;
}

interface ModelQuotaInfo {
  label: string;
  modelId: string;
  remainingPercentage?: number;
  isExhausted: boolean;
  resetTime?: string;
  timeUntilResetMs?: number;
  isAutocompleteOnly?: boolean;
}

export interface QuotaSnapshot {
  timestamp: string;
  method: 'local';
  email?: string;
  promptCredits?: PromptCreditsInfo;
  models: ModelQuotaInfo[];
}

export function parseLocalQuotaSnapshot(userStatus: ConnectUserStatus): QuotaSnapshot {
  const snapshot: QuotaSnapshot = {
    timestamp: new Date().toISOString(),
    method: 'local',
    email: userStatus.email,
    models: [],
  };

  if (userStatus.quota?.promptCredits) {
    snapshot.promptCredits = parsePromptCredits(userStatus.quota.promptCredits);
  }

  if (userStatus.quota?.models) {
    snapshot.models = userStatus.quota.models.map(parseModelQuota);
  }

  return snapshot;
}

function parsePromptCredits(
  credits: NonNullable<ConnectUserStatus['quota']>['promptCredits']
): PromptCreditsInfo | undefined {
  if (!credits) return undefined;
  const limit = credits.limit ?? 0;
  const remaining = credits.remaining ?? limit;
  const used = credits.used ?? (limit - remaining);
  if (limit === 0) return undefined;
  return {
    available: remaining,
    monthly: limit,
    usedPercentage: limit > 0 ? used / limit : 0,
    remainingPercentage: limit > 0 ? remaining / limit : 1,
  };
}

function parseModelQuota(
  model: NonNullable<NonNullable<ConnectUserStatus['quota']>['models']>[number]
): ModelQuotaInfo {
  const quota = model.quota;
  return {
    label: model.label || model.displayName || model.modelId,
    modelId: model.modelId,
    remainingPercentage: quota?.remainingPercentage,
    isExhausted: model.isExhausted ?? (quota?.remainingPercentage === 0),
    resetTime: quota?.resetTime,
    timeUntilResetMs: quota?.timeUntilResetMs,
    isAutocompleteOnly:
      model.modelId.includes('gemini-2.5') ||
      (model.label || '').includes('Gemini 2.5') ||
      (model.displayName || '').includes('Gemini 2.5'),
  };
}
