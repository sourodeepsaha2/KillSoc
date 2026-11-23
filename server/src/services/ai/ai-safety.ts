import { AI_CONFIG } from './ai.config.js';
import type {
  AiRepositoryGuidance,
  AiContributionGuidance
} from '../../types/index.js';
import type {
  AiRepoRecommendationContext,
  AiIssueRecommendationContext
} from './ai-provider.interface.js';

export class AiSafetyService {
  /**
   * Sanitizes external text and wraps it in passive delimiters to prevent prompt injection.
   */
  static sanitizeUntrustedInput(
    input: string | null | undefined,
    maxLength: number = AI_CONFIG.maxUntrustedTextLength
  ): string {
    if (!input || typeof input !== 'string') {
      return 'None provided.';
    }

    // Strip attempts to close tags or inject system directives
    let sanitized = input
      .replace(/<\/?untrusted_content>/gi, '')
      .replace(/<\/?system>/gi, '')
      .replace(/\[\/?system_instruction\]/gi, '')
      .replace(/ignore previous instructions/gi, '[filtered]');

    // Truncate to maximum permitted length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength) + '... [truncated for length]';
    }

    return `<untrusted_content>\n${sanitized.trim()}\n</untrusted_content>`;
  }

  /**
   * Cleans raw LLM response text, stripping markdown code blocks if present.
   */
  static extractJsonFromText(rawText: string): string {
    let cleaned = rawText.trim();

    // Remove markdown code fences like ```json ... ``` or ``` ... ```
    if (cleaned.startsWith('```')) {
      const firstNewline = cleaned.indexOf('\n');
      if (firstNewline !== -1) {
        cleaned = cleaned.slice(firstNewline + 1);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3).trim();
      }
    }

    // Locate the first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    return cleaned;
  }

  /**
   * Validates and normalizes structured Repository Guidance.
   */
  static validateRepositoryGuidance(parsed: any): AiRepositoryGuidance {
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('LLM response is not a valid JSON object');
    }

    const toStringArray = (val: any): string[] => {
      if (Array.isArray(val)) {
        return val.map((item) => String(item).trim()).filter((s) => s.length > 0);
      }
      return [];
    };

    const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'Repository recommended based on developer skill profile and activity metrics.';

    const reasoning = typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
      ? parsed.reasoning.trim()
      : 'This repository matches technical skills and demonstrates positive maintenance signals.';

    const matchedSkills = toStringArray(parsed.matchedSkills);
    const missingSkills = toStringArray(parsed.missingSkills);

    let learningCurve: 'Low' | 'Moderate' | 'High' = 'Moderate';
    if (typeof parsed.learningCurve === 'string') {
      const normalized = parsed.learningCurve.toLowerCase();
      if (normalized.includes('low')) learningCurve = 'Low';
      else if (normalized.includes('high')) learningCurve = 'High';
      else learningCurve = 'Moderate';
    }

    const learningCurveExplanation = typeof parsed.learningCurveExplanation === 'string' && parsed.learningCurveExplanation.trim()
      ? parsed.learningCurveExplanation.trim()
      : `Estimated as ${learningCurve} difficulty based on codebase scope and required skills.`;

    const strengths = toStringArray(parsed.strengths);
    if (strengths.length === 0) {
      strengths.push('Active open-source community and structured codebase.');
    }

    const concerns = toStringArray(parsed.concerns);
    if (concerns.length === 0) {
      concerns.push('Check recent issue discussions for ongoing architectural changes.');
    }

    const nextSteps = toStringArray(parsed.nextSteps);
    if (nextSteps.length === 0) {
      nextSteps.push('Review the repository README and contributing guidelines.');
      nextSteps.push('Set up the development environment locally.');
    }

    return {
      summary,
      reasoning,
      matchedSkills,
      missingSkills,
      learningCurve,
      learningCurveExplanation,
      strengths,
      concerns,
      nextSteps
    };
  }

  /**
   * Validates and normalizes structured Contribution Guidance.
   */
  static validateContributionGuidance(parsed: any): AiContributionGuidance {
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('LLM response is not a valid JSON object');
    }

    const toStringArray = (val: any): string[] => {
      if (Array.isArray(val)) {
        return val.map((item) => String(item).trim()).filter((s) => s.length > 0);
      }
      return [];
    };

    const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'Contribution opportunity matched with developer skills and experience.';

    const reasoning = typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
      ? parsed.reasoning.trim()
      : 'Issue requirements align with developer proficiency and offer a concrete entry point.';

    const matchedSkills = toStringArray(parsed.matchedSkills);
    const missingSkills = toStringArray(parsed.missingSkills);

    let learningCurve: 'Low' | 'Moderate' | 'High' = 'Moderate';
    if (typeof parsed.learningCurve === 'string') {
      const normalized = parsed.learningCurve.toLowerCase();
      if (normalized.includes('low')) learningCurve = 'Low';
      else if (normalized.includes('high')) learningCurve = 'High';
      else learningCurve = 'Moderate';
    }

    const requirements = toStringArray(parsed.requirements);
    if (requirements.length === 0) {
      requirements.push('Read the issue description carefully and reproduce the reported behavior.');
    }

    const checklist = toStringArray(parsed.checklist);
    if (checklist.length === 0) {
      checklist.push('Fork and clone the repository locally.');
      checklist.push('Install dependencies and run test suite.');
      checklist.push('Create a dedicated git feature branch.');
    }

    const maintainerQuestions = toStringArray(parsed.maintainerQuestions);
    if (maintainerQuestions.length === 0) {
      maintainerQuestions.push('Is anyone currently assigned or working on this issue?');
      maintainerQuestions.push('Are there preferred design patterns or unit test conventions for this fix?');
    }

    const pitfallsToAvoid = toStringArray(parsed.pitfallsToAvoid);
    if (pitfallsToAvoid.length === 0) {
      pitfallsToAvoid.push('Submitting a pull request without adding automated unit tests.');
      pitfallsToAvoid.push('Opening a PR without commenting first to confirm assignment.');
    }

    const nextSteps = toStringArray(parsed.nextSteps);
    if (nextSteps.length === 0) {
      nextSteps.push('Comment on the issue expressing interest in contributing.');
      nextSteps.push('Review the repository CONTRIBUTING.md guide.');
    }

    return {
      summary,
      reasoning,
      matchedSkills,
      missingSkills,
      learningCurve,
      requirements,
      checklist,
      maintainerQuestions,
      pitfallsToAvoid,
      nextSteps
    };
  }

  /**
   * Deterministic evidence-based fallback when AI provider is unavailable.
   */
  static generateDeterministicRepoFallback(
    context: AiRepoRecommendationContext
  ): AiRepositoryGuidance {
    const { repository, match, intelligence } = context;
    const devSkills = context.developer.skills.map((s) => s.skillName);
    const repoSkills = repository.extractedSkills || [];

    const matchedSkills = match?.matchedSkills && match.matchedSkills.length > 0
      ? match.matchedSkills
      : devSkills.filter((s) => repoSkills.map((r) => r.toLowerCase()).includes(s.toLowerCase()));

    const missingSkills = match?.missingSkills && match.missingSkills.length > 0
      ? match.missingSkills
      : repoSkills.filter((r) => !devSkills.map((s) => s.toLowerCase()).includes(r.toLowerCase()));

    const matchScore = match?.matchScore ?? 75;
    const overallScore = intelligence?.scores?.overall ?? 70;
    const beginnerScore = intelligence?.scores?.beginner ?? 65;

    let learningCurve: 'Low' | 'Moderate' | 'High' = 'Moderate';
    if (beginnerScore >= 75 && missingSkills.length <= 1) {
      learningCurve = 'Low';
    } else if (missingSkills.length >= 4 || beginnerScore < 50) {
      learningCurve = 'High';
    }

    const strengths: string[] = [];
    if (intelligence?.scores?.activity && intelligence.scores.activity >= 70) {
      strengths.push(`High commit and contributor activity (activity score: ${intelligence.scores.activity}/100).`);
    } else {
      strengths.push(`Popular repository with ${repository.stars.toLocaleString()} GitHub stars.`);
    }

    if (context.gsoc?.isGSoCOrg) {
      strengths.push(
        `Belongs to GSoC organization ${context.gsoc.organizationName || 'participating organization'}${
          context.gsoc.years?.length ? ` (participated in ${context.gsoc.years.join(', ')})` : ''
        }.`
      );
    } else {
      strengths.push('Clear topic categorization and structured repository assets.');
    }

    const concerns: string[] = [];
    if (missingSkills.length > 0) {
      concerns.push(`Requires learning technologies: ${missingSkills.slice(0, 3).join(', ')}.`);
    }
    if (intelligence?.scores?.maintenance && intelligence.scores.maintenance < 50) {
      concerns.push('Maintenance score is moderate; review open PR review times before submitting code.');
    } else {
      concerns.push('Large codebase; prioritize reviewing contributing guidelines and directory structure.');
    }

    const nextSteps = [
      `Review ${repository.fullName} README and contributing guidelines at ${repository.htmlUrl}`,
      'Clone repository locally and build according to developer instructions',
      'Inspect open good-first-issue opportunities'
    ];

    return {
      summary: `Recommended ${repository.fullName} based on ${matchedSkills.length} matching skills and match score of ${matchScore}%.`,
      reasoning: `Your skills in ${matchedSkills.length > 0 ? matchedSkills.join(', ') : 'core technologies'} directly match ${repository.fullName}'s tech stack. With an overall intelligence score of ${overallScore}/100, this repository offers a transparent open-source environment.`,
      matchedSkills,
      missingSkills,
      learningCurve,
      learningCurveExplanation: `Assessed as ${learningCurve} learning curve: developer has ${matchedSkills.length} matching skills, needs ${missingSkills.length} new skill(s), and repo has beginner score of ${beginnerScore}/100.`,
      strengths,
      concerns,
      nextSteps
    };
  }

  /**
   * Deterministic evidence-based fallback for issue recommendations when AI provider is unavailable.
   */
  static generateDeterministicIssueFallback(
    context: AiIssueRecommendationContext
  ): AiContributionGuidance {
    const { issue, repository, developer } = context;
    const devSkills = developer.skills.map((s) => s.skillName);
    const issueLabels = issue.labels || [];

    const matchedSkills = devSkills.filter(
      (s) =>
        issueLabels.map((l) => l.toLowerCase()).includes(s.toLowerCase()) ||
        (repository.language && repository.language.toLowerCase() === s.toLowerCase()) ||
        issue.title.toLowerCase().includes(s.toLowerCase())
    );

    const learningCurve: 'Low' | 'Moderate' | 'High' = issue.isBeginnerFriendly ? 'Low' : 'Moderate';

    const requirements = [
      `Analyze issue #${issue.number}: "${issue.title}"`,
      ...(issue.labels.length > 0 ? [`Address labels: ${issue.labels.join(', ')}`] : ['Examine issue discussion for specific requirements'])
    ];

    const checklist = [
      `Fork and clone ${repository.fullName} locally`,
      'Reproduce the issue or verify the reported behavior on your machine',
      'Create a dedicated git branch for the fix or feature',
      'Write targeted unit tests verifying your solution passes',
      'Confirm existing automated tests pass before opening a pull request'
    ];

    const maintainerQuestions = [
      `Hello! I would like to work on issue #${issue.number}. Is this currently available to take on?`,
      'Are there specific guidelines or test fixtures I should follow for this component?'
    ];

    const pitfallsToAvoid = [
      'Submitting a large PR that touches unrelated files',
      'Neglecting to run linting or code formatters before committing',
      'Submitting a PR without linking back to issue #' + issue.number
    ];

    const nextSteps = [
      `Comment on GitHub issue #${issue.number} at ${issue.url} to claim the task`,
      'Inspect project CONTRIBUTING.md for branch naming and commit conventions'
    ];

    return {
      summary: `Recommended issue #${issue.number} ("${issue.title}") in ${repository.fullName}.`,
      reasoning: `This issue is open in ${repository.fullName} and matches your technical background. Flagged as ${issue.isBeginnerFriendly ? 'beginner-friendly' : 'standard'} open-source task.`,
      matchedSkills: matchedSkills.length > 0 ? matchedSkills : [repository.language || 'General Programming'],
      missingSkills: [],
      learningCurve,
      requirements,
      checklist,
      maintainerQuestions,
      pitfallsToAvoid,
      nextSteps
    };
  }
}
