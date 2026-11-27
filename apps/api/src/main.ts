#!/usr/bin/env tsx
// @nx-target-name: serve
import { ChannelId } from '@alerts/shared';
import { buildApp } from './app';
import { createChannelRegistry } from './channels/registry';
import { loadConfig, loadRootEnvFile } from './config';
import { createDb } from './db/client';
import { syncRegistryRows } from './db/registry-sync';

async function main(): Promise<void> {
  loadRootEnvFile();
  const config = loadConfig(process.env);
  const { db, pool } = createDb(config.DATABASE_URL);
  const channels = createChannelRegistry(config);
  // Sources are added with the source registry in a later part.
  await syncRegistryRows(db, { channelIds: ChannelId.options, sources: [] });
  const app = await buildApp(config, { db, channels });
  app.addHook('onClose', async () => {
    await pool.end();
  });

  let closing = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    app.log.info(`${signal} received, closing the server`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', (signal) => void shutdown(signal));
  process.on('SIGTERM', (signal) => void shutdown(signal));

  await app.listen({ port: config.PORT, host: 'localhost' });

  // Set when Nx waits for this server to be ready
  if (process.env.NX_READY_SIGNAL_SOCKET) {
    // Function keeps TypeScript and bundlers from rewriting or bundling the import.
    const load = new Function('s', 'return import(s)') as (
      s: string,
    ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
    load('@nx/js/ready-signal')
      .then((readySignal) => readySignal.emitReadySignal(app.server))
      .catch(() => {
        // @nx/js isn't installed
      });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
