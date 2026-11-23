import { aiRecommendationService } from '../../services/ai/ai-recommendation.service.js';
import type { AiRecommendationsPayload } from '../job.types.js';
import type { JobProgressUpdater } from './org-sync.handler.js';

export const handleAiRecommendationsJob = async (
  payload: AiRecommendationsPayload,
  updateProgress?: JobProgressUpdater
): Promise<{
  userId: string;
  count: number;
  recommendationIds: string[];
}> => {
  if (updateProgress) await updateProgress(20);

  const recommendations = await aiRecommendationService.generateRecommendations(
    payload.userId,
    payload.options
  );

  if (updateProgress) await updateProgress(100);

  return {
    userId: payload.userId,
    count: recommendations.length,
    recommendationIds: recommendations.map((r) => r.id)
  };
};
