import dotenv from 'dotenv';
import path from 'path';

// Load .env from current directory, package directory, or root monorepo
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { app } from './app';
import { syncWorker } from './jobs/worker';

const PORT = process.env.PORT || 4001;

const server = app.listen(PORT, () => {
  console.log(`[CatalogIQ API] Server running on http://localhost:${PORT}`);
  // Start the background sync worker loop
  syncWorker.start(2500);
});

process.on('SIGTERM', () => {
  console.log('[CatalogIQ API] SIGTERM received. Shutting down gracefully.');
  syncWorker.stop();
  server.close();
});
