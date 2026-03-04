import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { buildApp } from './app.js';
import { startTelemetry } from './services/telemetry-service.js';

async function start() {
  const app = await buildApp();

  const port = parseInt(process.env.API_PORT ?? '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Lock Core API running on port ${port}`);
  startTelemetry(app.log);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Public API exports (used by @uselock/saas and other consumers)
export { buildApp } from './app.js';
export type { BuildAppOptions } from './app.js';
export { db, pool } from './db/client.js';
export * as schema from './db/schema.js';
export { authMiddleware, registerAuthStrategy, clearAuthStrategies } from './lib/auth.js';
export type { AuthStrategy } from './lib/auth.js';
export { onBeforeCommit, onAfterCommit, clearHooks } from './lib/hooks.js';
export type { CommitHookContext } from './lib/hooks.js';
