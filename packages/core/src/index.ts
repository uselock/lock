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

// Only start the server when this file is the entry point (not when imported as a library by @uselock/saas)
const entryFile = process.argv[1] && path.resolve(process.argv[1]);
const thisFile = fileURLToPath(import.meta.url);
const isEntryPoint = entryFile === thisFile;

if (isEntryPoint) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

// Public API exports (used by @uselock/saas and other consumers)
export { buildApp } from './app.js';
export type { BuildAppOptions } from './app.js';
export { db, pool } from './db/client.js';
export * as schema from './db/schema.js';
export { authMiddleware, registerAuthStrategy, clearAuthStrategies } from './lib/auth.js';
export type { AuthStrategy } from './lib/auth.js';
export {
  onBeforeCommit, onAfterCommit, clearHooks,
  registerSlackTokenProvider, getSlackTokenProvider,
  registerConflictDetectionGate, shouldRunConflictDetection,
  registerKnowledgeSynthesisGate, shouldRunKnowledgeSynthesis,
  registerSearchGate, shouldUseFullSearch,
  registerBeforeCreateProduct, runBeforeCreateProductHooks,
  registerAnalyticsProvider, trackEvent, captureException, identifyUser,
} from './lib/hooks.js';
export type { CommitHookContext, AnalyticsProvider } from './lib/hooks.js';
