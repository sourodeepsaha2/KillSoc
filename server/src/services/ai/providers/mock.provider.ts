import type {
  AiProvider,
  AiRepoRecommendationContext,
  AiIssueRecommendationContext
} from '../ai-provider.interface.js';
import type {
  AiRepositoryGuidance,
  AiContributionGuidance
} from '../../../types/index.js';
import { AiSafetyService } from '../ai-safety.js';

export class MockAiProvider implements AiProvider {
  public readonly name = 'mock';
  public readonly model = 'mock-v1';
  private shouldFail = false;

  constructor(options?: { shouldFail?: boolean }) {
    if (options?.shouldFail) {
      this.shouldFail = true;
    }
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  isAvailable(): boolean {
    return !this.shouldFail;
  }

  async generateRepositoryRecommendation(
    context: AiRepoRecommendationContext
  ): Promise<AiRepositoryGuidance> {
    if (this.shouldFail) {
      throw new Error('Mock AI Provider simulated failure / timeout');
    }

    // Verify prompt sanitization didn't crash
    AiSafetyService.sanitizeUntrustedInput(context.repository.description);

    const devSkills = context.developer.skills.map((s) => s.skillName);
    const repoSkills = context.repository.extractedSkills || [];

    const matched = context.match?.matchedSkills?.length
      ? context.match.matchedSkills
      : devSkills.filter((s) => repoSkills.map((r) => r.toLowerCase()).includes(s.toLowerCase()));

    const missing = context.match?.missingSkills?.length
      ? context.match.missingSkills
      : repoSkills.filter((r) => !devSkills.map((s) => s.toLowerCase()).includes(r.toLowerCase()));

    const learningCurve: 'Low' | 'Moderate' | 'High' =
      missing.length <= 1 ? 'Low' : missing.length <= 3 ? 'Moderate' : 'High';

    const strengths: string[] = [
      `Active repository with ${context.repository.stars.toLocaleString()} GitHub stars`,
      `Matches developer skills in ${matched.slice(0, 3).join(', ') || 'core language'}`
    ];

    if (context.gsoc?.isGSoCOrg) {
      strengths.push(
        `Associated with GSoC organization ${context.gsoc.organizationName || 'verified GSoC org'}`
      );
    }

    const concerns: string[] = [];
    if (missing.length > 0) {
      concerns.push(`Requires ramp-up on: ${missing.slice(0, 2).join(', ')}`);
    } else {
      concerns.push('Large codebase: follow existing module conventions carefully');
    }

    return {
      summary: `AI Match: ${context.repository.fullName} strongly aligns with your ${matched.join(', ') || 'developer'} profile.`,
      reasoning: `Analysis of ${context.repository.fullName} shows high synergy with your technical background. Your experience with ${matched.join(', ') || 'development'} equips you well for its architectural patterns.`,
      matchedSkills: matched,
      missingSkills: missing,
      learningCurve,
      learningCurveExplanation: `Assessed as ${learningCurve} based on ${matched.length} matched skills and ${missing.length} unmastered skills.`,
      strengths,
      concerns,
      nextSteps: [
        `Clone ${context.repository.fullName} from ${context.repository.htmlUrl}`,
        'Read CONTRIBUTING.md and setup local testing environment',
        'Inspect available beginner issues'
      ]
    };
  }

  async generateContributionRecommendation(
    context: AiIssueRecommendationContext
  ): Promise<AiContributionGuidance> {
    if (this.shouldFail) {
      throw new Error('Mock AI Provider simulated failure / timeout');
    }

    // Verify sanitization
    AiSafetyService.sanitizeUntrustedInput(context.issue.body);
    AiSafetyService.sanitizeUntrustedInput(context.issue.title);

    const devSkills = context.developer.skills.map((s) => s.skillName);
    const issueLabels = context.issue.labels || [];

    const matched = devSkills.filter(
      (s) =>
        issueLabels.map((l) => l.toLowerCase()).includes(s.toLowerCase()) ||
        (context.repository.language && context.repository.language.toLowerCase() === s.toLowerCase())
    );

    const learningCurve: 'Low' | 'Moderate' | 'High' = context.issue.isBeginnerFriendly
      ? 'Low'
      : 'Moderate';

    return {
      summary: `Targeted Issue: #${context.issue.number} ("${context.issue.title}") in ${context.repository.fullName}.`,
      reasoning: `This open issue is ideal because it targets ${matched.join(', ') || context.repository.language || 'general development'} and has beginner-friendly signals.`,
      matchedSkills: matched.length > 0 ? matched : [context.repository.language || 'Software Engineering'],
      missingSkills: [],
      learningCurve,
      requirements: [
        `Understand the problem described in issue #${context.issue.number}`,
        'Verify reproduction steps in development environment'
      ],
      checklist: [
        `Fork and clone ${context.repository.fullName}`,
        'Set up local dependencies and verify existing tests pass',
        'Implement code fix on a dedicated branch',
        'Add regression tests'
      ],
      maintainerQuestions: [
        `Hi! I would love to tackle issue #${context.issue.number}. Is this open for assignment?`,
        'Are there any edge cases you recommend testing for this component?'
      ],
      pitfallsToAvoid: [
        'Making sweeping refactors outside the scope of this issue',
        'Submitting code without updating or adding tests'
      ],
      nextSteps: [
        `Leave a comment on GitHub issue #${context.issue.number} expressing interest`,
        `Inspect ${context.issue.url} for previous discussion`
      ]
    };
  }
}
