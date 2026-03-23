import crypto from 'crypto';
import { db } from '../db/client.js';
import { workspaces, locks, products } from '../db/schema.js';
import { count } from 'drizzle-orm';

const TELEMETRY_URL = process.env.LOCK_TELEMETRY_URL ?? 'https://telemetry.uselock.ai/v1/ping';
const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

let installId: string | null = null;

function getLocksBracket(n: number): string {
  if (n === 0) return '0';
  if (n <= 10) return '1-10';
  if (n <= 100) return '10-100';
  if (n <= 1000) return '100-1000';
  return '1000+';
}

async function getInstallId(): Promise<string> {
  if (installId) return installId;

  const firstWorkspace = await db.query.workspaces.findFirst();
  const seed = firstWorkspace?.id ?? crypto.randomUUID();
  installId = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
  return installId;
}

function getDetectedSurfaces(): string[] {
  const surfaces: string[] = ['core'];
  if (process.env.SLACK_BOT_TOKEN) surfaces.push('slack');
  return surfaces;
}

async function sendHeartbeat(log: { info: (msg: string) => void; debug: (msg: string) => void }): Promise<void> {
  try {
    const [id, lockCount, workspaceCount, productCount] = await Promise.all([
      getInstallId(),
      db.select({ value: count() }).from(locks).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(workspaces).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(products).then((r) => r[0]?.value ?? 0),
    ]);

    const payload = {
      install_id: id,
      version: '0.1.0',
      node_version: process.version,
      surfaces: getDetectedSurfaces(),
      locks_total: getLocksBracket(lockCount),
      workspaces: workspaceCount,
      products: productCount,
      has_openai: !!process.env.OPENAI_API_KEY,
      has_anthropic: !!process.env.ANTHROPIC_API_KEY,
      has_slack: !!process.env.SLACK_BOT_TOKEN,
    };

    await fetch(TELEMETRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    log.debug('Telemetry heartbeat sent');
  } catch {
    log.debug('Telemetry heartbeat failed (this is expected if the endpoint is not reachable)');
  }
}

export function startTelemetry(log: { info: (msg: string) => void; debug: (msg: string) => void }): void {
  if (process.env.LOCK_TELEMETRY !== 'true') return;

  log.info('Telemetry enabled, sending heartbeat');
  sendHeartbeat(log);
  setInterval(() => sendHeartbeat(log), HEARTBEAT_INTERVAL);
}
