import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { githubResourceService } from '../../services/github-resource.service.js';
import { githubTokenService } from '../../services/github-token.service.js';
import type { IssueSyncPayload } from '../job.types.js';
import type { JobProgressUpdater } from './org-sync.handler.js';

export const handleIssueSyncJob = async (
  payload: IssueSyncPayload,
  updateProgress?: JobProgressUpdater
): Promise<{
  owner: string;
  repo: string;
  syncedCount: number;
  beginnerCount: number;
}> => {
  if (updateProgress) await updateProgress(10);

  const fullName = `${payload.owner}/${payload.repo}`.toLowerCase();
  const repository = await prisma.repository.findFirst({
    where: {
      fullName: { equals: fullName, mode: 'insensitive' }
    }
  });

  if (!repository) {
    throw ApiError.notFound(`Repository "${fullName}" not found in database`);
  }

  const token = await githubTokenService.resolveOptionalAccessToken(payload.userId);

  if (updateProgress) await updateProgress(30);

  // Fetch open issues from GitHub (automatically filters out PRs)
  const issuesResult = await githubResourceService.getRepositoryIssues(
    payload.owner,
    payload.repo,
    { state: 'open', perPage: 100 },
    token
  );

  if (updateProgress) await updateProgress(60);

  let syncedCount = 0;
  let beginnerCount = 0;

  for (const item of issuesResult.data) {
    await prisma.issue.upsert({
      where: { githubIssueId: item.githubIssueId },
      create: {
        repositoryId: repository.id,
        githubIssueId: item.githubIssueId,
        number: item.number,
        title: item.title,
        description: item.body || null,
        url: item.url,
        state: 'open',
        labels: item.labels,
        isBeginnerFriendly: item.isBeginnerFriendly,
        matchingLabels: item.matchingLabels
      },
      update: {
        title: item.title,
        description: item.body || null,
        url: item.url,
        state: 'open',
        labels: item.labels,
        isBeginnerFriendly: item.isBeginnerFriendly,
        matchingLabels: item.matchingLabels
      }
    });

    syncedCount++;
    if (item.isBeginnerFriendly) {
      beginnerCount++;
    }
  }

  // Update open issues count on repository
  await prisma.repository.update({
    where: { id: repository.id },
    data: { openIssues: syncedCount }
  });

  if (updateProgress) await updateProgress(100);

  return {
    owner: payload.owner,
    repo: payload.repo,
    syncedCount,
    beginnerCount
  };
};
