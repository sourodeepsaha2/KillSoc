import { JobWorker } from './jobs/job.worker.js';
import { closeRedisConnection } from './jobs/redis.connection.js';
import { prisma } from './config/prisma.js';
import { env } from './config/env.js';

console.log(`Starting KillSoc background worker process (concurrency: ${env.BULLMQ_CONCURRENCY})...`);

const worker = new JobWorker();
worker.start();

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Gracefully stopping worker...`);
  try {
    await worker.close();
    await closeRedisConnection();
    await prisma.$disconnect();
    console.log('Worker shutdown complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during worker shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
