import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLog } from '@/database/entities/ai-usage-log.entity';
import { AiRule } from '@/database/entities/ai-rule.entity';
import { AiPromptHistory } from '@/database/entities/ai-prompt-history.entity';
import { AiPromptVersion } from '@/database/entities/ai-prompt-version.entity';
import { AI_PROVIDER } from './ai.provider';
import { AI_VISION_PROVIDER } from './ai.vision.provider';
import { AiService } from './ai.service';
import { AiCostService } from './cost/ai-cost.service';
import { AiUsageController } from './cost/ai-usage.controller';
import { AiPromptsController } from './prompt/ai-prompts.controller';
import { PromptManagerService } from './prompt/prompt-manager.service';
import { AiRuleEngineService } from './rules/ai-rule-engine.service';
import { AiRulesController } from './rules/ai-rules.controller';
import { AiHealthController } from './ai-health.controller';
import type { AiProviderName } from './ai.types';
import { AnthropicProvider } from './providers/anthropic.provider';
import { AnthropicVisionProvider } from './providers/anthropic.vision.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { GeminiVisionProvider } from './providers/gemini.vision.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { OpenAiVisionProvider } from './providers/openai.vision.provider';

/**
 * AI Engine Module
 * - Prompt: PromptManagerService (templates/ + Version + History)
 * - Cost / Rules / Vision / Providers
 * - 진입점: AiService
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      AiUsageLog,
      AiRule,
      AiPromptVersion,
      AiPromptHistory,
    ]),
  ],
  controllers: [AiUsageController, AiRulesController, AiPromptsController, AiHealthController],
  providers: [
    OpenAiProvider,
    AnthropicProvider,
    GeminiProvider,
    OpenAiVisionProvider,
    AnthropicVisionProvider,
    GeminiVisionProvider,
    {
      provide: AI_PROVIDER,
      inject: [
        ConfigService,
        OpenAiProvider,
        AnthropicProvider,
        GeminiProvider,
      ],
      useFactory: (
        config: ConfigService,
        openai: OpenAiProvider,
        anthropic: AnthropicProvider,
        gemini: GeminiProvider,
      ) => {
        const name = (config.get<AiProviderName>('ai.provider') ||
          'openai') as AiProviderName;
        switch (name) {
          case 'anthropic':
            return anthropic;
          case 'gemini':
            return gemini;
          case 'openai':
          default:
            return openai;
        }
      },
    },
    {
      provide: AI_VISION_PROVIDER,
      inject: [
        ConfigService,
        OpenAiVisionProvider,
        AnthropicVisionProvider,
        GeminiVisionProvider,
      ],
      useFactory: (
        config: ConfigService,
        openai: OpenAiVisionProvider,
        anthropic: AnthropicVisionProvider,
        gemini: GeminiVisionProvider,
      ) => {
        const name = (config.get<AiProviderName>('ai.visionProvider') ||
          config.get<AiProviderName>('ai.provider') ||
          'openai') as AiProviderName;
        switch (name) {
          case 'anthropic':
            return anthropic;
          case 'gemini':
            return gemini;
          case 'openai':
          default:
            return openai;
        }
      },
    },
    PromptManagerService,
    AiCostService,
    AiRuleEngineService,
    AiService,
  ],
  exports: [
    AiService,
    AiCostService,
    AiRuleEngineService,
    PromptManagerService,
  ],
})
export class AiModule {}
