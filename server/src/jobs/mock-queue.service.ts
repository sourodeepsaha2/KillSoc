import type { IJobQueue } from './job-queue.interface.js';
import type { JobType, JobStatus, JobStatusResponseDTO } from '../types/index.js';
import type { JobPayloadMap, EnqueueOptions, InternalJobRecord } from './job.types.js';
import { generateJobId } from './job.types.js';

export class MockJobQueue implements IJobQueue {
  private jobs: Map<string, InternalJobRecord> = new Map();
  private isClosed = false;

  isAvailable(): boolean {
    return !this.isClosed;
  }

  async enqueue<T extends JobType>(
    type: T,
    payload: JobPayloadMap[T],
    options?: EnqueueOptions
  ): Promise<{ jobId: string; status: JobStatus }> {
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
      } else {
        jobId = `${type}:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      }
    }

    // Deduplication check: If job already exists and is pending/active, return existing
    const existing = this.jobs.get(jobId);
    if (existing && (existing.status === 'waiting' || existing.status === 'active')) {
      return {
        jobId: existing.id,
        status: existing.status
      };
    }

    const userId = (payload as any).userId || 'system';

    const record: InternalJobRecord<T> = {
      id: jobId,
      name: type,
      data: payload,
      userId,
      status: options?.delay ? 'delayed' : 'waiting',
      progress: 0,
      createdAt: new Date(),
      attemptsMade: 0
    };

    this.jobs.set(jobId, record as any);

    return {
      jobId,
      status: record.status
    };
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponseDTO | null> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    let safeFailedReason: string | null = null;
    if (job.failedReason) {
      safeFailedReason = job.failedReason
        .replace(/token\s*[=:]\s*[\w\.-]+/gi, 'token=[REDACTED]')
        .replace(/bearer\s+[\w\.-]+/gi, 'bearer [REDACTED]')
        .slice(0, 300);
    }

    return {
      jobId: job.id,
      jobType: job.name,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt.toISOString(),
      processedAt: job.processedAt ? job.processedAt.toISOString() : null,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      failedReason: safeFailedReason,
      result: job.status === 'completed' ? job.result : undefined
    };
  }

  async getJobUserId(jobId: string): Promise<string | null> {
    const job = this.jobs.get(jobId);
    return job ? job.userId : null;
  }

  async close(): Promise<void> {
    this.isClosed = true;
  }

  // --- Testing & Simulation Helpers ---

  getInternalJob(jobId: string): InternalJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): InternalJobRecord[] {
    return Array.from(this.jobs.values());
  }

  updateProgress(jobId: string, progress: number): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = Math.max(0, Math.min(100, progress));
    }
  }

  markActive(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'active';
      job.processedAt = new Date();
      job.attemptsMade++;
    }
  }

  markCompleted(jobId: string, result?: unknown): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      job.result = result;
    }
  }

  markFailed(jobId: string, error: Error | string, canRetry: boolean = true): void {
    const job = this.jobs.get(jobId);
    if (job) {
      const reason = typeof error === 'string' ? error : error.message;
      job.failedReason = reason;
      if (canRetry && job.attemptsMade < 3) {
        job.status = 'delayed'; // BullMQ marks retryable jobs as delayed during backoff
      } else {
        job.status = 'failed';
      }
    }
  }

  clear(): void {
    this.jobs.clear();
  }
}
