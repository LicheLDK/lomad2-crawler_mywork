import { Injectable, Logger, Optional } from '@nestjs/common';
import { AiService } from '@/ai/ai.service';
import type {
  SearchKeywordInput,
  SearchKeywordOutput,
} from './search-keyword-generator.types';

/** 자주 쓰는 브랜드/모델 영문 별칭 (중고 검색 보강 · AI 미사용 시 fallback) */
const ALIASES: Record<string, string[]> = {
  시몬스: ['Simmons'],
  simmons: ['시몬스'],
  뷰티레스트: ['Beautyrest'],
  beautyrest: ['뷰티레스트'],
  에이스: ['Ace'],
  템퍼: ['Tempur'],
  tempur: ['템퍼'],
  씰리: ['Sealy'],
  sealy: ['씰리'],
  까사미아: ['Casamia'],
  한샘: ['Hanssem'],
  이케아: ['IKEA'],
  ikea: ['이케아'],
};

const CATEGORY_HINTS = [
  '침대',
  '매트리스',
  '소파',
  '테이블',
  '책상',
  '의자',
  '옷장',
  '냉장고',
  '세탁기',
  '에어컨',
];

/**
 * 주문정보 기반 검색어 자동 생성.
 * AI Engine(AiService.generateKeywords) 우선, 실패/비활성 시 규칙 기반 fallback.
 * 검색 UI는 변경하지 않는다.
 */
@Injectable()
export class SearchKeywordGeneratorService {
  private readonly logger = new Logger(SearchKeywordGeneratorService.name);

  constructor(@Optional() private readonly aiService?: AiService) {}

  /** 동기 규칙 기반 (하위 호환) */
  generate(input: SearchKeywordInput): SearchKeywordOutput {
    return this.generateRules(input);
  }

  /**
   * AI Keyword Generator 우선.
   * AI_ENABLED + OPENAI_API_KEY 이면 AiService, 아니면 규칙 fallback.
   */
  async generateAsync(
    input: SearchKeywordInput,
  ): Promise<SearchKeywordOutput> {
    if (this.aiService?.canGenerateKeywords()) {
      try {
        const result = await this.aiService.generateKeywords({
          brand: input.brand,
          productName: input.productName,
          modelName: input.modelName,
          option: input.option,
          color: input.color,
        });
        if (result.keywords.length > 0) {
          this.logger.log(
            `Keywords via AI Engine count=${result.keywords.length}`,
          );
          return result.keywords;
        }
        this.logger.warn('AI keywords empty — falling back to rules');
      } catch (error) {
        this.logger.warn(
          `AI keyword generation failed, using rules: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return this.generateRules(input);
  }

  private generateRules(input: SearchKeywordInput): SearchKeywordOutput {
    const brand = clean(input.brand);
    const productName = clean(input.productName);
    const modelName = clean(input.modelName);
    const option = clean(input.option);
    const color = clean(input.color);

    const candidates: string[] = [];

    push(candidates, joinParts(brand, modelName));
    push(candidates, modelName);
    push(candidates, joinParts(modelName, option));
    push(candidates, joinParts(modelName, color));
    push(candidates, joinParts(brand, modelName, option));
    push(candidates, joinParts(brand, modelName, color));

    if (productName) {
      if (brand && containsIgnoreCase(productName, brand)) {
        push(candidates, productName);
      } else {
        push(candidates, joinParts(brand, productName));
        push(candidates, productName);
      }
    }

    if (brand && productName) {
      for (const hint of CATEGORY_HINTS) {
        if (containsIgnoreCase(productName, hint)) {
          push(candidates, joinParts(brand, hint));
        }
      }
    }

    push(candidates, joinParts(brand, option));
    push(candidates, joinParts(brand, color));

    for (const alias of expandAliases(brand)) {
      push(candidates, joinParts(alias, modelName));
      for (const hint of CATEGORY_HINTS) {
        if (productName && containsIgnoreCase(productName, hint)) {
          push(candidates, joinParts(alias, hint));
        }
      }
    }
    for (const alias of expandAliases(modelName)) {
      push(candidates, alias);
      push(candidates, joinParts(brand, alias));
      push(candidates, joinParts(alias, option));
      push(candidates, joinParts(alias, color));
    }

    return dedupe(candidates).slice(0, 20);
  }
}

function clean(value?: string | null): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

function joinParts(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => clean(p))
    .filter(Boolean)
    .join(' ')
    .trim();
}

function push(list: string[], value: string) {
  const v = clean(value);
  if (v.length >= 2) list.push(v);
}

function containsIgnoreCase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function expandAliases(term: string): string[] {
  if (!term) return [];
  const key = term.toLowerCase();
  const fromMap = ALIASES[key] || ALIASES[term] || [];
  const partial: string[] = [];
  for (const [k, aliases] of Object.entries(ALIASES)) {
    if (key.includes(k.toLowerCase())) {
      partial.push(...aliases);
    }
  }
  return dedupe([...fromMap, ...partial]);
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
