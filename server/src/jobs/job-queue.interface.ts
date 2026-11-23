import type { JobType, JobStatus, JobStatusResponseDTO } from '../types/index.js';
import type { JobPayloadMap, EnqueueOptions } from './job.types.js';

export interface IJobQueue {
  /**
   * Enqueues a background job. Returns job ID and initial status.
   */
  enqueue<T extends JobType>(
    type: T,
    payload: JobPayloadMap[T],
    options?: EnqueueOptions
  ): Promise<{ jobId: string; status: JobStatus }>;

  /**
   * Retrieves sanitized job status and observability metadata.
   */
  getJobStatus(jobId: string): Promise<JobStatusResponseDTO | null>;

  /**
   * Retrieves the owner userId of a job for authorization/isolation checks.
   */
  getJobUserId(jobId: string): Promise<string | null>;

  /**
   * Graceful queue shutdown.
   */
  close(): Promise<void>;

  /**
   * Checks whether the underlying transport (e.g. Redis) is ready and accepting jobs.
   */
  isAvailable(): Promise<boolean> | boolean;
}
