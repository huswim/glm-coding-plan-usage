import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
