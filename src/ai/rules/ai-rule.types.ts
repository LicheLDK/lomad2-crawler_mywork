import type {
  AiRuleAction,
  AiRuleField,
  AiRuleOperator,
} from '@/database/entities/ai-rule.entity';

/** Config / JSON 규칙 정의 (DB seed 입력) */
export interface AiRuleDefinition {
  code: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
  priority?: number;
  field: AiRuleField | string;
  operator: AiRuleOperator | string;
  value: number;
  action: AiRuleAction | string;
  message?: string | null;
}

/** Rule Engine 평가 입력 */
export interface AiRuleContext {
  /** 0~100 */
  aiScore: number;
  /** 0~100 */
  matchingScore?: number | null;
  /** 0~100 */
  titleSimilarity?: number | null;
  /** 0~100 */
  imageSimilarity?: number | null;
  rentalPrice?: number | null;
  listingPrice?: number | null;
  /** 없으면 rental/listing 으로 계산 */
  priceDiffPercent?: number | null;
}

export interface AiRuleMatch {
  code: string;
  name: string;
  action: AiRuleAction | string;
  field: string;
  operator: string;
  value: number;
  actual: number | null;
  message: string | null;
  priority: number;
}

/** Rule Engine 평가 결과 */
export interface AiRuleEvaluation {
  createInvestigation: boolean;
  exclude: boolean;
  warnings: AiRuleMatch[];
  matched: AiRuleMatch[];
  /** create_investigation 규칙의 value (호환용 임계값) */
  createThreshold: number | null;
  context: AiRuleContext & { priceDiffPercent: number | null };
}
