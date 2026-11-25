import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { JobWorker } from './jobs/job.worker.js';
import { closeRedisConnection } from './jobs/redis.connection.js';

let embeddedWorker: JobWorker | null = null;
if (process.env.RUN_WORKER === 'true' || process.env.EMBED_WORKER === 'true') {
  console.log('[AceSoc API] RUN_WORKER is enabled. Starting embedded background worker...');
  embeddedWorker = new JobWorker();
  embeddedWorker.start();
}

const server = app.listen(env.PORT, () => {
  console.log(`[AceSoc API] Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`[AceSoc API] Health check available at http://localhost:${env.PORT}/api/health`);
  console.log(`[AceSoc API] DB health check available at http://localhost:${env.PORT}/api/health/db`);
});

// Graceful shutdown handlers
const handleShutdown = async (signal: string): Promise<void> => {
  console.log(`[AceSoc API] Received ${signal}. Initiating graceful shutdown...`);

  if (embeddedWorker) {
    try {
      await embeddedWorker.close();
      await closeRedisConnection();
      console.log('[AceSoc API] Embedded worker shut down cleanly.');
    } catch (err) {
      console.error('[AceSoc API] Error shutting down embedded worker:', err);
    }
  }

  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('[AceSoc API] Database disconnected.');
    } catch (err) {
      console.error('[AceSoc API] Error disconnecting from database:', err);
    }
    console.log('[AceSoc API] HTTP server closed cleanly.');
    process.exit(0);
  });

  // Force close after 10 seconds if graceful shutdown takes too long
  setTimeout(() => {
    console.error('[AceSoc API] Could not close connections in time, forcefully shutting down.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[AceSoc API] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('[AceSoc API] Uncaught Exception:', error);
  process.exit(1);
});
