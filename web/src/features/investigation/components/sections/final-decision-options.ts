import type { CheckCircle2 } from 'lucide-react';
import { Ban, Search, ShieldAlert, CheckCircle2 as Check } from 'lucide-react';
import type { FinalDecision } from '../../types';

export const FINAL_DECISION_OPTIONS: {
  value: FinalDecision;
  label: string;
  description: string;
  Icon: typeof CheckCircle2;
  tone: 'teal' | 'amber' | 'rose' | 'ink';
}[] = [
  {
    value: 'resale_confirmed',
    label: '재판매 확인',
    description: '무단 재판매로 판정합니다.',
    Icon: ShieldAlert,
    tone: 'rose',
  },
  {
    value: 'further_investigation',
    label: '추가 조사',
    description: '추가 조사가 필요하나 Case는 완료 처리합니다.',
    Icon: Search,
    tone: 'amber',
  },
  {
    value: 'false_positive',
    label: '오탐',
    description: 'AI/검색 결과가 오탐으로 판정합니다.',
    Icon: Ban,
    tone: 'ink',
  },
  {
    value: 'excluded',
    label: '제외',
    description: '조사 대상에서 제외합니다.',
    Icon: Check,
    tone: 'teal',
  },
];

export function finalDecisionLabel(value: FinalDecision | null | undefined) {
  return (
    FINAL_DECISION_OPTIONS.find((o) => o.value === value)?.label ?? value ?? '—'
  );
}
