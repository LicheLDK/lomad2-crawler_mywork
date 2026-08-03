import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '../lib/utils';

export type ToastTone = 'success' | 'error';

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

export type ToastOptions = {
  tone?: ToastTone;
};

let pushToastImpl: ((message: string, options?: ToastOptions) => void) | null =
  null;

/** 표시 시간 3초 */
const TOAST_MS = 3000;

/**
 * 공통 Toast — Search / Investigation / Rental / System 재사용
 * 위치: 우측 하단 · Animation: Slide Up + Fade · 닫기 버튼 지원
 */
export function toast(message: string, options?: ToastOptions) {
  pushToastImpl?.(message, options);
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, options?: ToastOptions) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `t-${Date.now()}`;
      const tone: ToastTone = options?.tone ?? 'success';
      setItems((prev) => [...prev, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );

  useEffect(() => {
    pushToastImpl = push;
    return () => {
      pushToastImpl = null;
    };
  }, [push]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-[10000] flex w-[min(92vw,380px)] flex-col gap-2"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm text-ink-800 shadow-soft animate-toastIn',
            t.tone === 'error' ? 'border-rose-200' : 'border-ink-100',
          )}
          role="status"
        >
          {t.tone === 'error' ? (
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
              aria-hidden
            />
          ) : (
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-teal-700"
              aria-hidden
            />
          )}
          <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
          <button
            type="button"
            className="rounded-md p-0.5 text-ink-400 transition hover:bg-sand-100 hover:text-ink-700"
            aria-label="닫기"
            onClick={() => dismiss(t.id)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
