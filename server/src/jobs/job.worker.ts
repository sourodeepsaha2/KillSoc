import { Worker, Job, UnrecoverableError } from 'bullmq';
import { getRedisConnection } from './redis.connection.js';
import { env } from '../config/env.js';
import { DEFAULT_QUEUE_NAME, JOB_NAMES } from './job.types.js';
import { handleOrgSyncJob } from './handlers/org-sync.handler.js';
import { handleRepoAnalysisJob } from './handlers/repo-analysis.handler.js';
import { handleSkillExtractionJob } from './handlers/skill-extraction.handler.js';
import { handleAiRecommendationsJob } from './handlers/ai-recommendations.handler.js';
import { handleIssueSyncJob } from './handlers/issue-sync.handler.js';

export class JobWorker {
  private worker: Worker | null = null;
  private isRunning = false;

  constructor(
    private readonly queueName: string = DEFAULT_QUEUE_NAME,
    private readonly concurrency: number = env.BULLMQ_CONCURRENCY || 5
  ) {}

  /**
   * Starts the BullMQ worker processing loop.
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    const connection = getRedisConnection();

    this.worker = new Worker(
      this.queueName,
      async (job: Job) => {
        return this.processJob(job);
      },
      {
        connection: connection as any,
        concurrency: this.concurrency,
        lockDuration: 30000,
        stalledInterval: 30000,
        maxStalledCount: 2
      }
    );

    this.setupListeners();
    this.isRunning = true;
  }

  /**
   * Processes a single job based on its registered job name.
   */
  async processJob(job: Job): Promise<unknown> {
    const progressUpdater = async (progress: number) => {
      await job.updateProgress(progress);
    };

    try {
      switch (job.name) {
        case JOB_NAMES.ORG_SYNC:
          return await handleOrgSyncJob(job.data, progressUpdater);

        case JOB_NAMES.REPO_ANALYSIS:
          return await handleRepoAnalysisJob(job.data, progressUpdater);

        case JOB_NAMES.SKILL_EXTRACTION:
          return await handleSkillExtractionJob(job.data, progressUpdater);

        case JOB_NAMES.AI_RECOMMENDATIONS:
          return await handleAiRecommendationsJob(job.data, progressUpdater);

        case JOB_NAMES.ISSUE_SYNC:
          return await handleIssueSyncJob(job.data, progressUpdater);

        default:
          throw new UnrecoverableError(`Unknown job name: "${job.name}"`);
      }
    } catch (err: any) {
      // If error is a permanent 400 or 404 (e.g. not found), don't retry indefinitely
      if (err.statusCode === 400 || err.statusCode === 404 || err.isOperational) {
        throw new UnrecoverableError(err.message || 'Permanent non-retryable error');
      }
      throw err;
    }
  }

  private setupListeners(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job: Job) => {
      if (env.NODE_ENV !== 'test') {
        console.log(`[Job Completed]: ID=${job.id} type=${job.name}`);
      }
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      if (env.NODE_ENV !== 'test') {
        console.warn(`[Job Failed]: ID=${job?.id} type=${job?.name} reason=${err.message}`);
      }
    });

    this.worker.on('stalled', (jobId: string) => {
      if (env.NODE_ENV !== 'test') {
        console.warn(`[Job Stalled]: ID=${jobId} will be re-attempted`);
      }
    });

    this.worker.on('error', (err: Error) => {
      if (env.NODE_ENV !== 'test') {
        console.warn(`[Worker Error]: ${err.message}`);
      }
    });
  }

  /**
   * Graceful shutdown of the worker process.
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      this.isRunning = false;
    }
  }

  get status(): 'running' | 'stopped' {
    return this.isRunning ? 'running' : 'stopped';
  }
}
