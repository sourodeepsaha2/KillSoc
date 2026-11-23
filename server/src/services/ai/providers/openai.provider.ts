import { AI_CONFIG, AI_SYSTEM_PROMPT } from '../ai.config.js';
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

export class OpenAiProvider implements AiProvider {
  public readonly name = 'openai';
  public readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(options?: {
    model?: string;
    apiKey?: string;
    timeoutMs?: number;
    baseUrl?: string;
  }) {
    this.model = options?.model || 'gpt-4o-mini';
    this.apiKey = options?.apiKey || AI_CONFIG.apiKey;
    this.timeoutMs = options?.timeoutMs || AI_CONFIG.timeoutMs;
    this.baseUrl = options?.baseUrl || 'https://api.openai.com/v1';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && !this.apiKey.includes('placeholder'));
  }

  private async callChatCompletion(userPrompt: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key is not configured');
    }

    const endpoint = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: AI_CONFIG.maxTokens
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `OpenAI API HTTP ${response.status}: ${errorText.slice(0, 200)}`
        );
      }

      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('OpenAI API returned empty or missing completion content');
      }

      return content;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error(`OpenAI API request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    }
  }

  async generateRepositoryRecommendation(
    context: AiRepoRecommendationContext
  ): Promise<AiRepositoryGuidance> {
    const devSkills = context.developer.skills
      .map((s) => `${s.skillName} (${s.proficiency})`)
      .join(', ');

    const sanitizedDesc = AiSafetyService.sanitizeUntrustedInput(
      context.repository.description
    );

    const prompt = `Return a JSON object with: summary, reasoning, matchedSkills (array), missingSkills (array), learningCurve ("Low"|"Moderate"|"High"), learningCurveExplanation, strengths (array), concerns (array), nextSteps (array).

DEVELOPER @${context.developer.username}:
Skills: ${devSkills || 'None'}

REPOSITORY:
Name: ${context.repository.fullName}
Language: ${context.repository.language}
Stars: ${context.repository.stars}
URL: ${context.repository.htmlUrl}
Skills: ${context.repository.extractedSkills.join(', ')}
Description:
${sanitizedDesc}

METRICS & MATCH:
Scores: Overall=${context.intelligence?.scores?.overall ?? 'N/A'}, Activity=${context.intelligence?.scores?.activity ?? 'N/A'}, Beginner=${context.intelligence?.scores?.beginner ?? 'N/A'}, Maintenance=${context.intelligence?.scores?.maintenance ?? 'N/A'}
Match: Score=${context.match?.matchScore ?? 'N/A'}%, Matched=${context.match?.matchedSkills?.join(', ') || 'None'}, Missing=${context.match?.missingSkills?.join(', ') || 'None'}
GSoC: ${context.gsoc?.isGSoCOrg ? `Yes (${context.gsoc.organizationName})` : 'No'}

Respond ONLY with valid JSON.`;

    const rawJson = await this.callChatCompletion(prompt);
    const cleaned = AiSafetyService.extractJsonFromText(rawJson);
    const parsed = JSON.parse(cleaned);
    return AiSafetyService.validateRepositoryGuidance(parsed);
  }

  async generateContributionRecommendation(
    context: AiIssueRecommendationContext
  ): Promise<AiContributionGuidance> {
    const devSkills = context.developer.skills
      .map((s) => `${s.skillName} (${s.proficiency})`)
      .join(', ');

    const sanitizedTitle = AiSafetyService.sanitizeUntrustedInput(
      context.issue.title,
      200
    );
    const sanitizedBody = AiSafetyService.sanitizeUntrustedInput(
      context.issue.body,
      1000
    );

    const prompt = `Return a JSON object with: summary, reasoning, matchedSkills (array), missingSkills (array), learningCurve ("Low"|"Moderate"|"High"), requirements (array), checklist (array), maintainerQuestions (array), pitfallsToAvoid (array), nextSteps (array).

DEVELOPER: @${context.developer.username}
Skills: ${devSkills || 'None'}

REPO: ${context.repository.fullName} (${context.repository.language}) - ${context.repository.htmlUrl}
ISSUE: #${context.issue.number} - State: ${context.issue.state} - BeginnerFriendly: ${context.issue.isBeginnerFriendly}
Labels: ${context.issue.labels.join(', ')}
Title: ${sanitizedTitle}
Body: ${sanitizedBody}
GSoC: ${context.gsoc?.isGSoCOrg ? `Yes (${context.gsoc.organizationName})` : 'No'}

Respond ONLY with valid JSON.`;

    const rawJson = await this.callChatCompletion(prompt);
    const cleaned = AiSafetyService.extractJsonFromText(rawJson);
    const parsed = JSON.parse(cleaned);
    return AiSafetyService.validateContributionGuidance(parsed);
  }
}
