import { formatRecapDigest } from '../lib/formatters.js';

interface DigestConfig {
  channelId: string;
  product?: string;
  schedule: 'daily' | 'weekly';
  hour: number;
  dayOfWeek?: number; // 0 = Sunday, 1 = Monday, etc.
}

const digestConfigs: DigestConfig[] = [];
let intervalId: ReturnType<typeof setInterval> | null = null;

export function addDigestConfig(config: DigestConfig): void {
  // Remove existing config for this channel
  const idx = digestConfigs.findIndex((c) => c.channelId === config.channelId);
  if (idx >= 0) {
    digestConfigs.splice(idx, 1);
  }
  digestConfigs.push(config);
}

export function removeDigestConfig(channelId: string): boolean {
  const idx = digestConfigs.findIndex((c) => c.channelId === channelId);
  if (idx >= 0) {
    digestConfigs.splice(idx, 1);
    return true;
  }
  return false;
}

export function getDigestConfigs(): DigestConfig[] {
  return [...digestConfigs];
}

export function startDigestScheduler(
  callApi: (method: string, path: string, body?: any) => Promise<any>,
  postMessage: (channelId: string, blocks: any[]) => Promise<void>,
): void {
  if (intervalId) return; // Already running

  // Check every hour
  intervalId = setInterval(async () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    for (const config of digestConfigs) {
      if (config.hour !== currentHour) continue;
      if (config.schedule === 'weekly' && config.dayOfWeek !== undefined && config.dayOfWeek !== currentDay) continue;

      try {
        const params = new URLSearchParams();
        if (config.product) params.set('product', config.product);
        // Daily: last 24h, Weekly: last 7d
        const since = config.schedule === 'daily'
          ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        params.set('since', since);

        const response = await callApi('GET', `/api/v1/locks/recap?${params.toString()}`);
        const recap = response.data || response;

        if (recap.summary?.total_decisions > 0) {
          const blocks = formatRecapDigest(recap, config.product);
          await postMessage(config.channelId, blocks);
        }
      } catch {
        // Silently skip failed digests
      }
    }
  }, 60 * 60 * 1000); // 1 hour
}

export function stopDigestScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
