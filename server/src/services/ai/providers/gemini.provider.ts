import { AI_CONFIG, AI_SYSTEM_PROMPT, REPOSITORY_RECOMMENDATION_SCHEMA, CONTRIBUTION_RECOMMENDATION_SCHEMA } from '../ai.config.js';
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

export class GeminiAiProvider implements AiProvider {
  public readonly name = 'gemini';
  public readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor(options?: { model?: string; apiKey?: string; timeoutMs?: number }) {
    this.model = options?.model || AI_CONFIG.defaultModel;
    this.apiKey = options?.apiKey || AI_CONFIG.apiKey;
    this.timeoutMs = options?.timeoutMs || AI_CONFIG.timeoutMs;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && !this.apiKey.includes('placeholder'));
  }

  private async callGeminiApi(
    prompt: string,
    schema: Record<string, unknown>
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key is not configured');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent?key=${encodeURIComponent(this.apiKey!)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: AI_SYSTEM_PROMPT }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: AI_CONFIG.maxTokens,
            responseMimeType: 'application/json',
            responseSchema: schema
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `Gemini API HTTP ${response.status}: ${errorText.slice(0, 200)}`
        );
      }

      const data: any = await response.json();
      const candidateText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText || typeof candidateText !== 'string') {
        throw new Error('Gemini API returned empty or missing candidate text');
      }

      return candidateText;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error(`Gemini API request timed out after ${this.timeoutMs}ms`);
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

    const prompt = `Generate a personalized repository recommendation for developer @${context.developer.username}.

VERIFIED DEVELOPER SKILLS:
${devSkills || 'None listed'}

VERIFIED REPOSITORY FACTS:
- Full Name: ${context.repository.fullName}
- Primary Language: ${context.repository.language || 'None'}
- GitHub Stars: ${context.repository.stars}
- GitHub URL: ${context.repository.htmlUrl}
- Extracted Skills: ${context.repository.extractedSkills.join(', ') || 'None'}
- Repository Description:
${sanitizedDesc}

INTELLIGENCE & METRICS:
- Overall Score: ${context.intelligence?.scores?.overall ?? 'N/A'}/100
- Activity Score: ${context.intelligence?.scores?.activity ?? 'N/A'}/100
- Contributor Friendliness / Beginner Score: ${context.intelligence?.scores?.beginner ?? 'N/A'}/100
- Maintenance Score: ${context.intelligence?.scores?.maintenance ?? 'N/A'}/100

DETERMINISTIC MATCH DETAILS:
- Match Score: ${context.match?.matchScore ?? 'N/A'}%
- Matched Skills: ${context.match?.matchedSkills?.join(', ') || 'None'}
- Missing Skills: ${context.match?.missingSkills?.join(', ') || 'None'}

GSOC DETAILS:
${
  context.gsoc?.isGSoCOrg
    ? `- Organization: ${context.gsoc.organizationName || 'Yes'} (Years: ${context.gsoc.years?.join(', ') || 'Past participant'})\n- Note: Contributing does not guarantee GSoC acceptance.`
    : '- Non-GSoC repository.'
}

Respond ONLY with JSON matching the provided schema.`;

    const rawJson = await this.callGeminiApi(
      prompt,
      REPOSITORY_RECOMMENDATION_SCHEMA
    );
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

    const prompt = `Generate actionable contribution guidance for developer @${context.developer.username} on issue #${context.issue.number}.

VERIFIED DEVELOPER SKILLS:
${devSkills || 'None listed'}

VERIFIED REPOSITORY:
- Name: ${context.repository.fullName}
- Language: ${context.repository.language || 'None'}
- URL: ${context.repository.htmlUrl}

VERIFIED ISSUE DETAILS:
- Number: #${context.issue.number}
- State: ${context.issue.state} (MUST BE OPEN)
- URL: ${context.issue.url}
- Beginner Friendly: ${context.issue.isBeginnerFriendly ? 'Yes' : 'No'}
- Labels: ${context.issue.labels.join(', ') || 'None'}
- Title:
${sanitizedTitle}
- Body:
${sanitizedBody}

GSOC DETAILS:
${
  context.gsoc?.isGSoCOrg
    ? `- Repository belongs to GSoC organization: ${context.gsoc.organizationName || 'Yes'}.\n- Crucial: State clearly that contributing does not guarantee GSoC selection.`
    : '- Non-GSoC repository.'
}

Respond ONLY with JSON matching the provided schema.`;

    const rawJson = await this.callGeminiApi(
      prompt,
      CONTRIBUTION_RECOMMENDATION_SCHEMA
    );
    const cleaned = AiSafetyService.extractJsonFromText(rawJson);
    const parsed = JSON.parse(cleaned);
    return AiSafetyService.validateContributionGuidance(parsed);
  }
}
