import { SCORING_CONFIG, ScoringConfig } from './scoring.config.js';
import type {
  GitHubRepoDTO,
  GitHubCommitDTO,
  GitHubContributorDTO,
  GitHubIssueDTO,
  CommunityProfileDTO,
  IntelligenceScores,
  IntelligenceExplanations,
  MetricsSummary,
  DocumentationSignals
} from '../../types/index.js';

export interface RepositoryRawData {
  repo: GitHubRepoDTO;
  commits: GitHubCommitDTO[];
  contributors: GitHubContributorDTO[];
  openIssues: GitHubIssueDTO[];
  closedIssues: GitHubIssueDTO[];
  community: CommunityProfileDTO;
  isDataComplete?: boolean;
}

export interface CalculationResult {
  scores: IntelligenceScores;
  explanations: IntelligenceExplanations;
  metricsSummary: MetricsSummary;
  isComplete: boolean;
}

export class IntelligenceCalculationService {
  constructor(private readonly config: ScoringConfig = SCORING_CONFIG) {}

  /**
   * Helper to round float scores to 1 decimal place.
   */
  private round(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  }

  /**
   * Calculates days elapsed between a past ISO date string and now.
   */
  private getDaysSince(dateStr?: string | null): number | null {
    if (!dateStr) return null;
    const past = new Date(dateStr).getTime();
    if (isNaN(past)) return null;
    const now = Date.now();
    const diff = Math.max(0, now - past);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculates Activity Score (0-100).
   * Evaluates commit frequency, last push/update recency, and recent issue activity.
   */
  calculateActivityScore(
    repo: GitHubRepoDTO,
    commits: GitHubCommitDTO[],
    openIssues: GitHubIssueDTO[]
  ): { score: number; explanations: string[] } {
    let score = 0;
    const explanations: string[] = [];

    // 1. Commit Frequency (Max 35 pts)
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    const commitsLast30Days = commits.filter(
      c => c.commitDate && new Date(c.commitDate).getTime() >= thirtyDaysAgo
    ).length;

    const commitsLast90Days = commits.filter(
      c => c.commitDate && new Date(c.commitDate).getTime() >= ninetyDaysAgo
    ).length;

    if (commitsLast30Days >= 10) {
      score += 35;
      explanations.push(`High commit velocity with ${commitsLast30Days} commits in the last 30 days (+35 pts).`);
    } else if (commitsLast30Days >= 5) {
      score += 28;
      explanations.push(`Solid commit activity with ${commitsLast30Days} commits in the last 30 days (+28 pts).`);
    } else if (commitsLast30Days >= 1) {
      score += 18;
      explanations.push(`Moderate commit activity with ${commitsLast30Days} commit(s) in the last 30 days (+18 pts).`);
    } else if (commitsLast90Days >= 1) {
      score += 8;
      explanations.push(`No commits in the last 30 days, but ${commitsLast90Days} commit(s) within 90 days (+8 pts).`);
    } else {
      explanations.push('No commit activity detected in the last 90 days (0 pts).');
    }

    // 2. Last Updated / Pushed Recency (Max 35 pts)
    const mostRecentCommitDate = commits[0]?.commitDate || repo.lastUpdatedAt;
    const daysSinceLastCommit = this.getDaysSince(mostRecentCommitDate);

    if (daysSinceLastCommit !== null) {
      if (daysSinceLastCommit <= 7) {
        score += 35;
        explanations.push(`Very recently updated (${daysSinceLastCommit} day(s) ago) (+35 pts).`);
      } else if (daysSinceLastCommit <= 14) {
        score += 30;
        explanations.push(`Updated ${daysSinceLastCommit} days ago (+30 pts).`);
      } else if (daysSinceLastCommit <= 30) {
        score += 24;
        explanations.push(`Updated ${daysSinceLastCommit} days ago (+24 pts).`);
      } else if (daysSinceLastCommit <= 60) {
        score += 16;
        explanations.push(`Updated ${daysSinceLastCommit} days ago (+16 pts).`);
      } else if (daysSinceLastCommit <= 90) {
        score += 8;
        explanations.push(`Last update was ${daysSinceLastCommit} days ago (+8 pts).`);
      } else {
        explanations.push(`Repository has been inactive for ${daysSinceLastCommit} days (0 pts).`);
      }
    } else {
      explanations.push('Unable to determine recency of last update.');
    }

    // 3. Recent Issue Activity (Max 30 pts)
    const recentIssues = openIssues.filter(
      i => i.updatedAt && new Date(i.updatedAt).getTime() >= thirtyDaysAgo
    ).length;

    if (recentIssues >= 5) {
      score += 30;
      explanations.push(`Vibrant issue activity with ${recentIssues} active issues updated recently (+30 pts).`);
    } else if (recentIssues >= 2) {
      score += 20;
      explanations.push(`Active issue discussions with ${recentIssues} issues updated recently (+20 pts).`);
    } else if (recentIssues === 1) {
      score += 10;
      explanations.push(`Minimal issue activity with 1 issue updated recently (+10 pts).`);
    } else if (repo.openIssues === 0) {
      score += 15;
      explanations.push('Zero open issues, clear issue tracker (+15 pts).');
    } else {
      explanations.push('No recent issue discussions or updates in the past 30 days.');
    }

    return {
      score: this.round(score),
      explanations
    };
  }

  /**
   * Calculates Community Score (0-100).
   * Evaluates contributor base, participation spread, and issue resolution ratio.
   */
  calculateCommunityScore(
    contributors: GitHubContributorDTO[],
    openIssues: GitHubIssueDTO[],
    closedIssues: GitHubIssueDTO[]
  ): { score: number; explanations: string[] } {
    let score = 0;
    const explanations: string[] = [];

    // 1. Contributor Base Size (Max 40 pts)
    const totalContributors = contributors.length;

    if (totalContributors >= 30) {
      score += 40;
      explanations.push(`Large and thriving contributor community with ${totalContributors}+ contributors (+40 pts).`);
    } else if (totalContributors >= 15) {
      score += 32;
      explanations.push(`Strong contributor base with ${totalContributors} contributors (+32 pts).`);
    } else if (totalContributors >= 5) {
      score += 22;
      explanations.push(`Growing contributor base with ${totalContributors} contributors (+22 pts).`);
    } else if (totalContributors >= 2) {
      score += 12;
      explanations.push(`Small contributor group with ${totalContributors} contributors (+12 pts).`);
    } else if (totalContributors === 1) {
      score += 5;
      explanations.push('Single contributor maintains this repository (+5 pts).');
    } else {
      explanations.push('No public contributors listed (0 pts).');
    }

    // 2. Contributor Participation Spread (Max 25 pts)
    if (contributors.length > 1) {
      const totalContributions = contributors.reduce((acc, c) => acc + c.contributionCount, 0);
      const topContributor = contributors[0];
      const topCount = topContributor?.contributionCount ?? 0;
      const topPercentage = totalContributions > 0 ? (topCount / totalContributions) * 100 : 100;

      if (topPercentage < 50) {
        score += 25;
        explanations.push(`Well-distributed ownership: top contributor accounts for ${Math.round(topPercentage)}% of commits (+25 pts).`);
      } else if (topPercentage < 80) {
        score += 16;
        explanations.push(`Moderate contributor distribution: top contributor has ${Math.round(topPercentage)}% of commits (+16 pts).`);
      } else {
        score += 8;
        explanations.push(`Concentrated contributions: top contributor accounts for ${Math.round(topPercentage)}% of commits (+8 pts).`);
      }
    } else if (contributors.length === 1) {
      score += 5;
      explanations.push('Sole maintainer repository with concentrated work (+5 pts).');
    }

    // 3. Issue Resolution Ratio (Max 35 pts)
    const closedCount = closedIssues.length;
    const openCount = openIssues.length;
    const totalSampledIssues = closedCount + openCount;

    if (totalSampledIssues > 0) {
      const resolutionRatio = closedCount / totalSampledIssues;
      if (resolutionRatio >= 0.6) {
        score += 35;
        explanations.push(`High issue resolution rate: ${Math.round(resolutionRatio * 100)}% of sampled issues are resolved (+35 pts).`);
      } else if (resolutionRatio >= 0.4) {
        score += 25;
        explanations.push(`Healthy issue resolution rate: ${Math.round(resolutionRatio * 100)}% of sampled issues are resolved (+25 pts).`);
      } else if (resolutionRatio >= 0.2) {
        score += 15;
        explanations.push(`Moderate issue resolution rate: ${Math.round(resolutionRatio * 100)}% resolved (+15 pts).`);
      } else if (closedCount > 0) {
        score += 8;
        explanations.push(`Low issue resolution rate: ${Math.round(resolutionRatio * 100)}% resolved (+8 pts).`);
      } else {
        score += 2;
        explanations.push('Few to no closed issues found in recent activity (+2 pts).');
      }
    } else {
      score += 20;
      explanations.push('No recent issue volume to evaluate resolution ratio (+20 pts neutral).');
    }

    return {
      score: this.round(score),
      explanations
    };
  }

  /**
   * Calculates Documentation Score (0-100).
   * Evaluates README, description, CONTRIBUTING guide, LICENSE, and Community Standards.
   */
  calculateDocumentationScore(
    repo: GitHubRepoDTO,
    community: CommunityProfileDTO
  ): { score: number; explanations: string[] } {
    let score = 0;
    const explanations: string[] = [];

    // 1. README (30 pts)
    if (community.hasReadme) {
      score += 30;
      explanations.push('README documentation present (+30 pts).');
    } else {
      explanations.push('Missing README documentation (-30 pts).');
    }

    // 2. Repository Description (15 pts)
    if (repo.description && repo.description.trim().length > 5) {
      score += 15;
      explanations.push('Clear repository description provided (+15 pts).');
    } else {
      explanations.push('Repository lacks an informative description (-15 pts).');
    }

    // 3. CONTRIBUTING Guide (25 pts)
    if (community.hasContributing) {
      score += 25;
      explanations.push('Dedicated CONTRIBUTING guide available for new developers (+25 pts).');
    } else {
      explanations.push('Missing CONTRIBUTING guide (-25 pts).');
    }

    // 4. Open Source LICENSE (15 pts)
    if (community.hasLicense) {
      score += 15;
      explanations.push('Open-source LICENSE clearly defined (+15 pts).');
    } else {
      explanations.push('No recognized LICENSE detected (-15 pts).');
    }

    // 5. Code of Conduct & Issue / PR Templates (15 pts)
    let communityExtras = 0;
    if (community.hasCodeOfConduct) communityExtras += 8;
    if (community.hasIssueTemplates || community.hasPullRequestTemplates) communityExtras += 7;

    score += communityExtras;
    if (communityExtras === 15) {
      explanations.push('Code of Conduct and structured Issue/PR templates present (+15 pts).');
    } else if (communityExtras > 0) {
      explanations.push(`Partial community standards configured (+${communityExtras} pts).`);
    } else {
      explanations.push('No Code of Conduct or Issue/PR templates found.');
    }

    return {
      score: this.round(score),
      explanations
    };
  }

  /**
   * Calculates Beginner Friendliness Score (0-100).
   * Evaluates presence of beginner labels, qualifying open issues, and contributing documentation.
   */
  calculateBeginnerScore(
    openIssues: GitHubIssueDTO[],
    community: CommunityProfileDTO
  ): { score: number; explanations: string[] } {
    let score = 0;
    const explanations: string[] = [];

    const beginnerIssues = openIssues.filter(i => i.isBeginnerFriendly);
    const beginnerCount = beginnerIssues.length;

    // 1. Qualifying Beginner Open Issues (Max 40 pts)
    if (beginnerCount >= 5) {
      score += 40;
      explanations.push(`Excellent opportunity: ${beginnerCount} beginner-friendly issues currently open (+40 pts).`);
    } else if (beginnerCount >= 3) {
      score += 30;
      explanations.push(`Good opportunity: ${beginnerCount} beginner-friendly issues available (+30 pts).`);
    } else if (beginnerCount >= 1) {
      score += 20;
      explanations.push(`${beginnerCount} beginner-friendly issue(s) available (+20 pts).`);
    } else {
      explanations.push('No open issues tagged with beginner-friendly labels found (0 pts).');
    }

    // 2. Presence of Beginner Contributor Labels in Repository (Max 30 pts)
    const hasAnyBeginnerLabels = openIssues.some(i => i.matchingLabels.length > 0);
    if (hasAnyBeginnerLabels) {
      score += 30;
      explanations.push('Repository actively uses standard beginner labels (e.g. good first issue, help wanted) (+30 pts).');
    } else {
      explanations.push('Repository does not appear to use standard beginner issue labels (0 pts).');
    }

    // 3. Contributing Guidelines (Max 20 pts)
    if (community.hasContributing) {
      score += 20;
      explanations.push('CONTRIBUTING guide provides onboarding instructions for beginners (+20 pts).');
    } else {
      explanations.push('Lack of CONTRIBUTING guide increases onboarding barrier for beginners (-20 pts).');
    }

    // 4. Beginner Issue Proportion (Max 10 pts)
    if (beginnerCount > 0 && openIssues.length > 0) {
      const proportion = (beginnerCount / openIssues.length) * 100;
      if (proportion >= 10) {
        score += 10;
        explanations.push(`${Math.round(proportion)}% of open issues are tailored for newcomers (+10 pts).`);
      } else {
        score += 5;
        explanations.push(`${Math.round(proportion)}% of open issues are tagged for newcomers (+5 pts).`);
      }
    }

    return {
      score: this.round(score),
      explanations
    };
  }

  /**
   * Calculates Maintenance Score (0-100).
   * Penalizes archived or dormant repositories, accounts for fork status, maintenance recency, and issue backlog.
   */
  calculateMaintenanceScore(
    repo: GitHubRepoDTO,
    commits: GitHubCommitDTO[],
    openIssues: GitHubIssueDTO[]
  ): { score: number; explanations: string[] } {
    const explanations: string[] = [];

    // 1. Strict Archived Check: If archived, Maintenance Score is 0
    if (repo.isArchived) {
      explanations.push('Repository is archived on GitHub; maintenance is completely halted (0 pts).');
      return {
        score: 0,
        explanations
      };
    }

    let score = 0;

    // 2. Fork Status (Max 20 pts)
    if (!repo.isFork) {
      score += 20;
      explanations.push('Original standalone repository, not a fork (+20 pts).');
    } else {
      score += 10;
      explanations.push('Repository is a fork of another project (+10 pts).');
    }

    // 3. Maintenance Recency (Max 45 pts)
    const mostRecentCommitDate = commits[0]?.commitDate || repo.lastUpdatedAt;
    const daysSinceLastCommit = this.getDaysSince(mostRecentCommitDate);

    if (daysSinceLastCommit !== null) {
      if (daysSinceLastCommit <= 14) {
        score += 45;
        explanations.push(`Actively maintained: commit or push within ${daysSinceLastCommit} day(s) (+45 pts).`);
      } else if (daysSinceLastCommit <= 30) {
        score += 36;
        explanations.push(`Regularly maintained: last activity ${daysSinceLastCommit} days ago (+36 pts).`);
      } else if (daysSinceLastCommit <= 60) {
        score += 26;
        explanations.push(`Moderate maintenance: last activity ${daysSinceLastCommit} days ago (+26 pts).`);
      } else if (daysSinceLastCommit <= 90) {
        score += 16;
        explanations.push(`Infrequent maintenance: last activity ${daysSinceLastCommit} days ago (+16 pts).`);
      } else if (daysSinceLastCommit <= 180) {
        score += 6;
        explanations.push(`Stale maintenance: last activity ${daysSinceLastCommit} days ago (+6 pts).`);
      } else {
        explanations.push(`Dormant repository: no maintenance activity for ${daysSinceLastCommit} days (0 pts).`);
      }
    } else {
      explanations.push('Unable to determine maintenance recency.');
    }

    // 4. Issue Backlog Health (Max 35 pts)
    const openCount = repo.openIssues ?? openIssues.length;
    if (openCount <= 50) {
      score += 35;
      explanations.push(`Well-managed issue backlog (${openCount} open issues) (+35 pts).`);
    } else if (openCount <= 150) {
      score += 28;
      explanations.push(`Manageable issue backlog (${openCount} open issues) (+28 pts).`);
    } else if (openCount <= 400) {
      score += 18;
      explanations.push(`Elevated issue backlog with ${openCount} open issues (+18 pts).`);
    } else if (openCount <= 1000) {
      score += 10;
      explanations.push(`Heavy issue backlog with ${openCount} open issues (+10 pts).`);
    } else {
      score += 4;
      explanations.push(`Massive issue backlog with ${openCount} open issues (+4 pts).`);
    }

    return {
      score: this.round(score),
      explanations
    };
  }

  /**
   * Main calculation entry point. Computes all individual metrics, overall weighted score,
   * explains factors, and constructs complete metrics summary.
   */
  calculateReport(data: RepositoryRawData): CalculationResult {
    const { repo, commits, contributors, openIssues, closedIssues, community } = data;

    const activityRes = this.calculateActivityScore(repo, commits, openIssues);
    const communityRes = this.calculateCommunityScore(contributors, openIssues, closedIssues);
    const docRes = this.calculateDocumentationScore(repo, community);
    const beginnerRes = this.calculateBeginnerScore(openIssues, community);
    const maintenanceRes = this.calculateMaintenanceScore(repo, commits, openIssues);

    const weights = this.config.weights;
    let weightedOverall =
      activityRes.score * weights.activity +
      communityRes.score * weights.community +
      docRes.score * weights.documentation +
      beginnerRes.score * weights.beginner +
      maintenanceRes.score * weights.maintenance;

    const overallExplanations: string[] = [];

    // Handle archived status capping
    if (repo.isArchived) {
      weightedOverall = Math.min(weightedOverall, this.config.archivedScoreCap);
      overallExplanations.push(
        `Repository is archived. Maintenance score is 0 and overall score is capped at ${this.config.archivedScoreCap}.`
      );
    } else {
      overallExplanations.push(
        `Overall score computed using weighted model: Activity (${Math.round(weights.activity * 100)}%), ` +
          `Maintenance (${Math.round(weights.maintenance * 100)}%), ` +
          `Community (${Math.round(weights.community * 100)}%), ` +
          `Documentation (${Math.round(weights.documentation * 100)}%), ` +
          `Beginner Friendliness (${Math.round(weights.beginner * 100)}%).`
      );
    }

    const overallScore = this.round(weightedOverall);

    const scores: IntelligenceScores = {
      overall: overallScore,
      activity: activityRes.score,
      community: communityRes.score,
      documentation: docRes.score,
      beginner: beginnerRes.score,
      maintenance: maintenanceRes.score
    };

    const explanations: IntelligenceExplanations = {
      overall: overallExplanations,
      activity: activityRes.explanations,
      community: communityRes.explanations,
      documentation: docRes.explanations,
      beginner: beginnerRes.explanations,
      maintenance: maintenanceRes.explanations
    };

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    const commitsCountLast30Days = commits.filter(
      c => c.commitDate && new Date(c.commitDate).getTime() >= thirtyDaysAgo
    ).length;

    const commitsCountLast90Days = commits.filter(
      c => c.commitDate && new Date(c.commitDate).getTime() >= ninetyDaysAgo
    ).length;

    const mostRecentCommitDate = commits[0]?.commitDate || repo.lastUpdatedAt;

    const documentationSignals: DocumentationSignals = {
      hasReadme: community.hasReadme,
      hasDescription: Boolean(repo.description && repo.description.trim().length > 0),
      hasContributing: community.hasContributing,
      hasLicense: community.hasLicense,
      hasCodeOfConduct: community.hasCodeOfConduct,
      hasIssueTemplates: community.hasIssueTemplates
    };

    const beginnerIssuesCount = openIssues.filter(i => i.isBeginnerFriendly).length;

    const metricsSummary: MetricsSummary = {
      commitsCountLast90Days,
      commitsCountLast30Days,
      daysSinceLastCommit: this.getDaysSince(mostRecentCommitDate),
      daysSinceLastPush: this.getDaysSince(repo.lastUpdatedAt),
      contributorsCount: contributors.length,
      openIssuesCount: repo.openIssues ?? openIssues.length,
      closedIssuesCount: closedIssues.length,
      beginnerIssuesCount,
      starsCount: repo.stars,
      forksCount: repo.forks,
      isArchived: repo.isArchived,
      isFork: repo.isFork,
      documentation: documentationSignals
    };

    const isComplete = data.isDataComplete !== false;

    return {
      scores,
      explanations,
      metricsSummary,
      isComplete
    };
  }
}

export const intelligenceCalculationService = new IntelligenceCalculationService();
