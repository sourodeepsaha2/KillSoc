import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { repositorySkillExtractor } from '../../services/matching/repository-skill-extractor.service.js';
import type { SkillExtractionPayload } from '../job.types.js';
import type { JobProgressUpdater } from './org-sync.handler.js';

export const handleSkillExtractionJob = async (
  payload: SkillExtractionPayload,
  updateProgress?: JobProgressUpdater
): Promise<{
  repositoryId: string;
  fullName: string;
  extractedSkills: string[];
}> => {
  if (updateProgress) await updateProgress(20);

  const repo = await prisma.repository.findUnique({
    where: { id: payload.repositoryId }
  });

  if (!repo) {
    throw ApiError.notFound(`Repository ID "${payload.repositoryId}" not found`);
  }

  if (updateProgress) await updateProgress(50);

  const extracted = repositorySkillExtractor.extractRepositorySkills(
    {
      language: repo.language,
      description: repo.description,
      topics: repo.topics
    },
    null,
    []
  );

  const updatedRepo = await prisma.repository.update({
    where: { id: repo.id },
    data: { extractedSkills: extracted.allSkills }
  });

  if (updateProgress) await updateProgress(100);

  return {
    repositoryId: updatedRepo.id,
    fullName: updatedRepo.fullName,
    extractedSkills: updatedRepo.extractedSkills
  };
};
