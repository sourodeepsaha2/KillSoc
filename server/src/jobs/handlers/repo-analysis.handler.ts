import { repositoryIntelligenceService } from '../../services/intelligence/repository-intelligence.service.js';
import type { RepoAnalysisPayload } from '../job.types.js';
import type { JobProgressUpdater } from './org-sync.handler.js';

export const handleRepoAnalysisJob = async (
  payload: RepoAnalysisPayload,
  updateProgress?: JobProgressUpdater
): Promise<{
  repository: string;
  overallScore: number;
  activityScore: number;
  beginnerScore: number;
  isComplete: boolean;
}> => {
  if (updateProgress) await updateProgress(15);

  const analysis = await repositoryIntelligenceService.getOrCalculateAnalysis(
    payload.owner,
    payload.repo,
    {
      force: payload.forceRefresh,
      userId: payload.userId
    }
  );

  if (updateProgress) await updateProgress(100);

  return {
    repository: analysis.fullName,
    overallScore: analysis.scores.overall,
    activityScore: analysis.scores.activity,
    beginnerScore: analysis.scores.beginner,
    isComplete: analysis.isComplete
  };
};
