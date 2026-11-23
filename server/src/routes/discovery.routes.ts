import { Router } from 'express';
import {
  getOrganizations,
  getOrganizationBySlug,
  getOrganizationRepos,
  getIssues,
  getIssueDetail,
  importOrganizations,
  syncOrganization
} from '../controllers/discovery.controller.js';
import { requireAuth, optionalAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router: Router = Router();

// 1. Organization Discovery Routes (Public with optional personalization)
router.get('/organizations', optionalAuth, asyncHandler(getOrganizations));
router.get('/organizations/:slug', optionalAuth, asyncHandler(getOrganizationBySlug));
router.get('/organizations/:slug/repos', optionalAuth, asyncHandler(getOrganizationRepos));

// 2. Contribution Opportunity Discovery Routes (Public)
router.get('/issues', optionalAuth, asyncHandler(getIssues));
router.get('/issues/:owner/:repo/:issueNumber', optionalAuth, asyncHandler(getIssueDetail));

// 3. Administrative Ingestion & Synchronization Routes
router.post('/organizations/import', requireAdmin, asyncHandler(importOrganizations));
router.post('/organizations/:slug/sync', requireAuth, asyncHandler(syncOrganization));

export default router;
