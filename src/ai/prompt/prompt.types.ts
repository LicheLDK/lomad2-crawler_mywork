import type { PromptKey } from './catalog';

export type PromptVars = Record<string, unknown>;

export interface PromptMeta {
  key: PromptKey | string;
  version: number;
  name: string;
  description?: string;
}

export interface PromptTemplateContent {
  key: string;
  version: number;
  name: string;
  description: string | null;
  systemTemplate: string;
  userTemplate: string;
  source: 'file' | 'db';
  active: boolean;
}

/** 렌더 결과 — LLM 메시지용 */
export interface RenderedPrompt {
  key: string;
  version: number;
  system: string;
  user: string;
}

export interface PromptTreeNode {
  key: string;
  name: string;
  activeVersion: number | null;
  versions: number[];
  description: string | null;
  source: 'file' | 'db' | 'mixed';
}

export interface PromptUpdateInput {
  systemTemplate: string;
  userTemplate: string;
  name?: string;
  description?: string | null;
  note?: string | null;
  changedBy?: string | null;
}

export interface PromptHistoryItem {
  id: string;
  key: string;
  version: number;
  systemTemplate: string;
  userTemplate: string;
  note: string | null;
  changedBy: string | null;
  createdAt: Date;
}
