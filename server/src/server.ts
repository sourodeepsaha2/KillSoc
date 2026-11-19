import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

const server = app.listen(env.PORT, () => {
  console.log(`[KillSoc API] Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`[KillSoc API] Health check available at http://localhost:${env.PORT}/api/health`);
  console.log(`[KillSoc API] DB health check available at http://localhost:${env.PORT}/api/health/db`);
});

// Graceful shutdown handlers
const handleShutdown = async (signal: string): Promise<void> => {
  console.log(`[KillSoc API] Received ${signal}. Initiating graceful shutdown...`);
  
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('[KillSoc API] Database disconnected.');
    } catch (err) {
      console.error('[KillSoc API] Error disconnecting from database:', err);
    }
    console.log('[KillSoc API] HTTP server closed cleanly.');
    process.exit(0);
  });

  // Force close after 10 seconds if graceful shutdown takes too long
  setTimeout(() => {
    console.error('[KillSoc API] Could not close connections in time, forcefully shutting down.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[KillSoc API] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('[KillSoc API] Uncaught Exception:', error);
  process.exit(1);
});
