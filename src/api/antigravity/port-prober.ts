import https from 'https';
import http from 'http';

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
