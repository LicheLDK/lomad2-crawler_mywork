import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X } from 'lucide-react';

type ToastItem = {
  id: string;
  message: string;
};

let pushToastImpl: ((message: string) => void) | null = null;

/** 어디서든 Toast 표시 */
export function toast(message: string) {
  pushToastImpl?.(message);
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `t-${Date.now()}`;
    setItems((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  useEffect(() => {
    pushToastImpl = push;
    return () => {
      pushToastImpl = null;
    };
  }, [push]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[10000] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-800 shadow-soft animate-fadeUp"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
          <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
          <button
            type="button"
            className="rounded-md p-0.5 text-ink-400 transition hover:bg-sand-100 hover:text-ink-700"
            aria-label="닫기"
            onClick={() =>
              setItems((prev) => prev.filter((x) => x.id !== t.id))
            }
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
