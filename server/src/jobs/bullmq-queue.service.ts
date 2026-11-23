import { Queue, Job } from 'bullmq';
import { getRedisConnection, isRedisHealthy } from './redis.connection.js';
import { env } from '../config/env.js';
import type { IJobQueue } from './job-queue.interface.js';
import type { JobType, JobStatus, JobStatusResponseDTO } from '../types/index.js';
import type { JobPayloadMap, EnqueueOptions } from './job.types.js';
import { DEFAULT_QUEUE_NAME, generateJobId } from './job.types.js';

export class BullMQJobQueue implements IJobQueue {
  private queue: Queue;

  constructor(queueName: string = DEFAULT_QUEUE_NAME) {
    const connection = getRedisConnection();
    this.queue = new Queue(queueName, {
      connection: connection as any,
      defaultJobOptions: {
        attempts: env.BULLMQ_MAX_RETRIES || 3,
        backoff: {
          type: 'exponential',
          delay: env.BULLMQ_BACKOFF_DELAY_MS || 2000
        },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 172800 }
      }
    });
  }

  async isAvailable(): Promise<boolean> {
    return isRedisHealthy();
  }

  async enqueue<T extends JobType>(
    type: T,
    payload: JobPayloadMap[T],
    options?: EnqueueOptions
  ): Promise<{ jobId: string; status: JobStatus }> {
    // Generate deterministic job ID for deduplication if not provided
    let jobId = options?.jobId;
    if (!jobId) {
      if (type === 'org-sync' && 'organizationSlug' in payload) {
        jobId = generateJobId(type, (payload as any).organizationSlug);
      } else if (type === 'repo-analysis' && 'owner' in payload && 'repo' in payload) {
        jobId = generateJobId(type, `${(payload as any).owner}/${(payload as any).repo}`);
      } else if (type === 'ai-recommendations' && 'userId' in payload) {
        jobId = generateJobId(type, (payload as any).userId);
      } else if (type === 'skill-extraction' && 'repositoryId' in payload) {
        jobId = generateJobId(type, (payload as any).repositoryId);
      } else if (type === 'issue-sync' && 'owner' in payload && 'repo' in payload) {
        jobId = generateJobId(type, `${(payload as any).owner}/${(payload as any).repo}`);
      }
    }

    const job = await this.queue.add(type, payload, {
      jobId,
      delay: options?.delay,
      priority: options?.priority,
      attempts: options?.attempts || env.BULLMQ_MAX_RETRIES || 3
    });

    const state = await job.getState();
    return {
      jobId: job.id || jobId || 'unknown',
      status: this.mapBullMQState(state)
    };
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponseDTO | null> {
    const job: Job | undefined = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const status = this.mapBullMQState(state);

    // Sanitize failure reason to avoid exposing sensitive tokens or internal trace
    let safeFailedReason: string | null = null;
    if (job.failedReason) {
      safeFailedReason = job.failedReason
        .replace(/token\s*[=:]\s*[\w\.-]+/gi, 'token=[REDACTED]')
        .replace(/bearer\s+[\w\.-]+/gi, 'bearer [REDACTED]')
        .slice(0, 300);
    }

    let progress = 0;
    if (typeof job.progress === 'number') {
      progress = job.progress;
    } else if (status === 'completed') {
      progress = 100;
    }

    return {
      jobId: String(job.id),
      jobType: job.name as JobType,
      status,
      progress,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      failedReason: safeFailedReason,
      result: status === 'completed' ? job.returnvalue : undefined
    };
  }

  async getJobUserId(jobId: string): Promise<string | null> {
    const job: Job | undefined = await this.queue.getJob(jobId);
    if (!job || !job.data) {
      return null;
    }
    return job.data.userId || null;
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  private mapBullMQState(state: string): JobStatus {
    switch (state) {
      case 'active':
        return 'active';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'delayed':
        return 'delayed';
      case 'waiting':
      case 'prioritized':
      case 'wait':
      default:
        return 'waiting';
    }
  }
}
