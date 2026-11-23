import type { JobType, JobStatus, AiGenerationOptions } from '../types/index.js';

export const JOB_NAMES = {
  ORG_SYNC: 'org-sync' as JobType,
  REPO_ANALYSIS: 'repo-analysis' as JobType,
  SKILL_EXTRACTION: 'skill-extraction' as JobType,
  AI_RECOMMENDATIONS: 'ai-recommendations' as JobType,
  ISSUE_SYNC: 'issue-sync' as JobType
} as const;

export const DEFAULT_QUEUE_NAME = 'killsoc-background-jobs';

export interface OrgSyncPayload {
  organizationSlug: string;
  userId: string;
  force?: boolean;
}

export interface RepoAnalysisPayload {
  owner: string;
  repo: string;
  repositoryId?: string;
  userId: string;
  forceRefresh?: boolean;
}

export interface SkillExtractionPayload {
  repositoryId: string;
  userId?: string;
}

export interface AiRecommendationsPayload {
  userId: string;
  options?: AiGenerationOptions;
}

export interface IssueSyncPayload {
  owner: string;
  repo: string;
  repositoryId?: string;
  userId: string;
}

export interface JobPayloadMap {
  'org-sync': OrgSyncPayload;
  'repo-analysis': RepoAnalysisPayload;
  'skill-extraction': SkillExtractionPayload;
  'ai-recommendations': AiRecommendationsPayload;
  'issue-sync': IssueSyncPayload;
}

export interface EnqueueOptions {
  jobId?: string;
  delay?: number;
  priority?: number;
  attempts?: number;
}

export interface InternalJobRecord<T extends JobType = JobType> {
  id: string;
  name: T;
  data: JobPayloadMap[T];
  userId: string;
  status: JobStatus;
  progress: number;
  createdAt: Date;
  processedAt?: Date | null;
  completedAt?: Date | null;
  failedReason?: string | null;
  result?: unknown;
  attemptsMade: number;
}

/**
 * Creates deterministic, deduplicated job IDs to prevent duplicate queued work.
 */
export const generateJobId = (type: JobType, identifier: string): string => {
  const cleanId = identifier.trim().toLowerCase().replace(/[\/\s:]+/g, '-');
  return `${type}:${cleanId}`;
};
