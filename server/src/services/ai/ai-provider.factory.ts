import { AI_CONFIG } from './ai.config.js';
import type { AiProvider } from './ai-provider.interface.js';
import { GeminiAiProvider } from './providers/gemini.provider.js';
import { MockAiProvider } from './providers/mock.provider.js';
import { OpenAiProvider } from './providers/openai.provider.js';

let customProviderInstance: AiProvider | null = null;

export class AiProviderFactory {
  /**
   * For testing purposes, allows setting a custom or mock provider instance.
   */
  static setCustomProvider(provider: AiProvider | null): void {
    customProviderInstance = provider;
  }

  /**
   * Returns the configured or active AI Provider instance.
   */
  static getProvider(name?: string): AiProvider {
    if (customProviderInstance) {
      return customProviderInstance;
    }

    const providerName = (name || AI_CONFIG.defaultProvider).toLowerCase();

    switch (providerName) {
      case 'mock':
        return new MockAiProvider();
      case 'openai':
        return new OpenAiProvider();
      case 'gemini':
      default:
        return new GeminiAiProvider();
    }
  }

  /**
   * Checks if the active provider has valid credentials.
   */
  static isConfigured(name?: string): boolean {
    const provider = this.getProvider(name);
    return provider.isAvailable() === true;
  }
}
