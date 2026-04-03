import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const debug = () => {};

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
  const eqMatch = commandLine.match(new RegExp(`${argName}=([^\\s"']+|"[^"]*"|'[^']*')`, 'i'));
  if (eqMatch) return eqMatch[1].replace(/^["']|["']$/g, '');
  const spaceMatch = commandLine.match(new RegExp(`${argName}\\s+([^\\s"']+|"[^"]*"|'[^']*')`, 'i'));
  if (spaceMatch) return spaceMatch[1].replace(/^["']|["']$/g, '');
  return null;
}

void debug;
