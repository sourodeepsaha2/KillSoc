import type { Request, Response, NextFunction } from 'express';
import { JobQueueFactory } from '../jobs/job-queue.factory.js';
import { ApiError } from '../utils/apiError.js';
import { JOB_NAMES } from '../jobs/job.types.js';

export class JobController {
  /**
   * POST /api/jobs/organizations/:slug/sync
   * Enqueues an organization synchronization job. Returns 202 Accepted.
   */
  async syncOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { slug } = req.params;
      if (!slug || !slug.trim()) {
        throw ApiError.badRequest('Organization slug parameter is required');
      }

      const queue = JobQueueFactory.getQueue();
      const force = Boolean(req.body?.force);

      const enqueued = await queue.enqueue(JOB_NAMES.ORG_SYNC, {
        organizationSlug: slug.trim(),
        userId: req.user.userId,
        force
      });

      res.status(202).json({
        success: true,
        message: `Organization synchronization job queued for "${slug}"`,
        data: {
          jobId: enqueued.jobId,
          jobType: JOB_NAMES.ORG_SYNC,
          status: enqueued.status,
          createdAt: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/jobs/repos/:owner/:repo/analyze
   * Enqueues a repository intelligence analysis job. Returns 202 Accepted.
   */
  async analyzeRepository(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { owner, repo } = req.params;
      if (!owner || !repo || !owner.trim() || !repo.trim()) {
        throw ApiError.badRequest('Both owner and repo parameters are required');
      }

      const queue = JobQueueFactory.getQueue();
      const forceRefresh = Boolean(req.body?.forceRefresh);

      const enqueued = await queue.enqueue(JOB_NAMES.REPO_ANALYSIS, {
        owner: owner.trim(),
        repo: repo.trim(),
        userId: req.user.userId,
        forceRefresh
      });

      res.status(202).json({
        success: true,
        message: `Repository analysis job queued for "${owner}/${repo}"`,
        data: {
          jobId: enqueued.jobId,
          jobType: JOB_NAMES.REPO_ANALYSIS,
          status: enqueued.status,
          createdAt: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/jobs/recommendations/generate
   * Enqueues an AI recommendation generation job for authenticated developer. Returns 202 Accepted.
   */
  async generateRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const queue = JobQueueFactory.getQueue();

      const enqueued = await queue.enqueue(JOB_NAMES.AI_RECOMMENDATIONS, {
        userId: req.user.userId,
        options: req.body?.options || {}
      });

      res.status(202).json({
        success: true,
        message: 'AI recommendation generation job queued successfully',
        data: {
          jobId: enqueued.jobId,
          jobType: JOB_NAMES.AI_RECOMMENDATIONS,
          status: enqueued.status,
          createdAt: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/jobs/:jobId
   * Retrieves sanitized job status, ensuring the requesting user owns the job.
   */
  async getJobStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { jobId } = req.params;
      if (!jobId || !jobId.trim()) {
        throw ApiError.badRequest('Job ID parameter is required');
      }

      const queue = JobQueueFactory.getQueue();

      // Retrieve job owner for authorization check
      const jobOwnerId = await queue.getJobUserId(jobId);
      if (!jobOwnerId) {
        throw ApiError.notFound(`Job with ID "${jobId}" not found`);
      }

      // Enforce strict user isolation: only owner can query their job status
      if (jobOwnerId !== req.user.userId) {
        throw ApiError.notFound(`Job with ID "${jobId}" not found`);
      }

      const status = await queue.getJobStatus(jobId);
      if (!status) {
        throw ApiError.notFound(`Job with ID "${jobId}" not found`);
      }

      res.status(200).json({
        success: true,
        data: status
      });
    } catch (err) {
      next(err);
    }
  }
}

export const jobController = new JobController();
