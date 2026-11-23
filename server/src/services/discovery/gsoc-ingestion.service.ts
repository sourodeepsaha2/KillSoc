import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import type { GSoCOrgImportInput, GSoCImportResult } from '../../types/index.js';

export class GSoCIngestionService {
  /**
   * Generates a URL-friendly canonical slug from an organization name.
   */
  slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Validates and extracts a clean GitHub organization login from a URL or username string.
   */
  extractGitHubLogin(githubUrlOrLogin?: string | null): string | null {
    if (!githubUrlOrLogin || typeof githubUrlOrLogin !== 'string') return null;
    const clean = githubUrlOrLogin.trim();
    if (!clean) return null;

    try {
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        const url = new URL(clean);
        if (url.hostname.includes('github.com')) {
          const parts = url.pathname.split('/').filter(Boolean);
          if (parts[0]) return parts[0];
        }
        return null;
      }
      // Bare login string
      return clean.replace(/[^a-zA-Z0-9_-]/g, '') || null;
    } catch {
      return null;
    }
  }

  /**
   * Validates an individual GSoC organization input entry.
   */
  validateEntry(entry: GSoCOrgImportInput): { isValid: boolean; error?: string } {
    if (!entry || typeof entry !== 'object') {
      return { isValid: false, error: 'Entry must be a valid JSON object' };
    }

    if (!entry.name || typeof entry.name !== 'string' || !entry.name.trim()) {
      return { isValid: false, error: 'Organization name is required and must be non-empty' };
    }

    if (!entry.year || typeof entry.year !== 'number' || !Number.isInteger(entry.year)) {
      return { isValid: false, error: 'Valid integer GSoC year is required' };
    }

    if (entry.year < 2005 || entry.year > 2030) {
      return { isValid: false, error: 'GSoC year must be between 2005 and 2030' };
    }

    if (entry.website && typeof entry.website === 'string') {
      const trimmed = entry.website.trim();
      if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return { isValid: false, error: 'Website must be a valid HTTP or HTTPS URL' };
      }
    }

    if (entry.githubUrl && typeof entry.githubUrl === 'string') {
      const trimmed = entry.githubUrl.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (!trimmed.includes('github.com')) {
          return { isValid: false, error: 'githubUrl must be a valid GitHub URL or login' };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Parses topic lists from array or comma-separated string format.
   */
  private parseTopics(topicsInput?: string[] | string): string[] {
    if (!topicsInput) return [];
    if (Array.isArray(topicsInput)) {
      return topicsInput
        .map(t => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
        .filter(Boolean);
    }
    if (typeof topicsInput === 'string') {
      return topicsInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
    }
    return [];
  }

  /**
   * Imports an array of validated GSoC organization entries into PostgreSQL,
   * preserving historical participation and avoiding duplicate records.
   */
  async ingestOrganizations(
    entries: GSoCOrgImportInput[],
    sourceMetadata: { sourceUrl?: string; importedBy?: string } = {}
  ): Promise<GSoCImportResult> {
    if (!Array.isArray(entries)) {
      throw ApiError.badRequest('Import payload must be an array of organization records');
    }

    let organizationsCreated = 0;
    let organizationsUpdated = 0;
    let yearsAdded = 0;
    const errors: Array<{ item: string; error: string }> = [];

    for (const entry of entries) {
      const validation = this.validateEntry(entry);
      if (!validation.isValid) {
        errors.push({
          item: entry?.name || 'Unknown Entry',
          error: validation.error || 'Validation failed'
        });
        continue;
      }

      try {
        const slug = entry.slug
          ? this.slugify(entry.slug)
          : this.slugify(entry.name);

        const topics = this.parseTopics(entry.topics);
        const githubLogin = this.extractGitHubLogin(entry.githubUrl);
        const normalizedGithubUrl = githubLogin
          ? `https://github.com/${githubLogin}`
          : entry.githubUrl?.trim() || null;

        // 1. Upsert Organization
        const existingOrg = await prisma.organization.findUnique({
          where: { slug }
        });

        let orgId = '';
        if (existingOrg) {
          // Merge topics uniquely
          const combinedTopics = Array.from(
            new Set([...existingOrg.topics, ...topics])
          );

          await prisma.organization.update({
            where: { id: existingOrg.id },
            data: {
              name: entry.name.trim(),
              description: entry.description?.trim() || existingOrg.description,
              website: entry.website?.trim() || existingOrg.website,
              githubUrl: normalizedGithubUrl || existingOrg.githubUrl,
              category: entry.category?.trim() || existingOrg.category,
              topics: combinedTopics,
              imageUrl: entry.imageUrl?.trim() || existingOrg.imageUrl,
              sourceUrl: entry.sourceUrl?.trim() || sourceMetadata.sourceUrl || existingOrg.sourceUrl
            }
          });
          orgId = existingOrg.id;
          organizationsUpdated++;
        } else {
          const createdOrg = await prisma.organization.create({
            data: {
              name: entry.name.trim(),
              slug,
              description: entry.description?.trim() || null,
              website: entry.website?.trim() || null,
              githubUrl: normalizedGithubUrl,
              category: entry.category?.trim() || null,
              topics,
              imageUrl: entry.imageUrl?.trim() || null,
              sourceUrl: entry.sourceUrl?.trim() || sourceMetadata.sourceUrl || null
            }
          });
          orgId = createdOrg.id;
          organizationsCreated++;
        }

        // 2. Upsert OrganizationYear
        const existingYear = await prisma.organizationYear.findUnique({
          where: {
            organizationId_year: {
              organizationId: orgId,
              year: entry.year
            }
          }
        });

        if (!existingYear) {
          await prisma.organizationYear.create({
            data: {
              organizationId: orgId,
              year: entry.year,
              projectsUrl: entry.projectsUrl?.trim() || null,
              ideasUrl: entry.ideasUrl?.trim() || null,
              topics
            }
          });
          yearsAdded++;
        }
      } catch (err) {
        errors.push({
          item: entry.name,
          error: err instanceof Error ? err.message : 'Database error occurred during import'
        });
      }
    }

    return {
      totalProcessed: entries.length,
      organizationsCreated,
      organizationsUpdated,
      yearsAdded,
      errors
    };
  }

  /**
   * Imports GSoC organization data from a verified remote URL.
   */
  async importFromRemoteUrl(
    url: string,
    importedBy?: string
  ): Promise<GSoCImportResult> {
    if (!url || !url.startsWith('http')) {
      throw ApiError.badRequest('A valid HTTP or HTTPS data source URL is required');
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json, text/plain, */*' },
        signal: AbortSignal.timeout(15000)
      });
    } catch {
      throw ApiError.badRequest(`Failed to connect to data source URL: ${url}`);
    }

    if (!response.ok) {
      throw ApiError.badRequest(
        `Remote data source returned HTTP ${response.status}: ${response.statusText}`
      );
    }

    let rawData: unknown;
    try {
      rawData = await response.json();
    } catch {
      throw ApiError.badRequest('Remote source did not return valid JSON');
    }

    // Support both direct array and nested results (e.g. { organizations: [...] } or { data: [...] })
    let entries: GSoCOrgImportInput[] = [];
    if (Array.isArray(rawData)) {
      entries = rawData;
    } else if (
      rawData &&
      typeof rawData === 'object' &&
      Array.isArray((rawData as any).organizations)
    ) {
      entries = (rawData as any).organizations;
    } else if (
      rawData &&
      typeof rawData === 'object' &&
      Array.isArray((rawData as any).data)
    ) {
      entries = (rawData as any).data;
    } else {
      throw ApiError.badRequest('Remote JSON payload must contain an array of organization records');
    }

    return this.ingestOrganizations(entries, { sourceUrl: url, importedBy });
  }
}

export const gsocIngestionService = new GSoCIngestionService();
