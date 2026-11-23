import { organizationSyncService } from '../../services/discovery/organization-sync.service.js';
import type { OrgSyncPayload } from '../job.types.js';

export interface JobProgressUpdater {
  (progress: number): Promise<void> | void;
}

export const handleOrgSyncJob = async (
  payload: OrgSyncPayload,
  updateProgress?: JobProgressUpdater
): Promise<{
  organization: string;
  slug: string;
  syncedRepositories: number;
  analyzedRepositories: number;
}> => {
  if (updateProgress) await updateProgress(10);

  const result = await organizationSyncService.syncOrganizationRepositories(
    payload.organizationSlug,
    payload.userId
  );

  if (updateProgress) await updateProgress(100);

  return result;
};
