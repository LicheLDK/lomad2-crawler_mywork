import { createPortal } from 'react-dom';
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

export type ConfirmVariant = 'default' | 'danger' | 'warning' | 'success';
export type ConfirmSize = 'sm' | 'md' | 'lg';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  /** 본문 description 외에 구조화된 콘텐츠가 필요할 때 */
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  /** md = 440px (기본) */
  size?: ConfirmSize;
};

const SIZE_CLASS: Record<ConfirmSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-[440px]',
  lg: 'max-w-lg',
};

const CONFIRM_CLASS: Record<ConfirmVariant, string> = {
  default: 'bg-ink-900 text-sand-50 hover:bg-ink-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
  warning: 'bg-amber-600 text-white hover:bg-amber-500',
  success: 'bg-teal-700 text-white hover:bg-teal-600',
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 재사용 Confirm Dialog
 * — Portal / ESC / Outside Click / Focus Trap / Keyboard Nav
 * — Fade + Scale 200ms · Width 440px · Radius 16px · Padding 24px
 */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
  size = 'md',
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);
  onCancelRef.current = onCancel;
  onConfirmRef.current = onConfirm;

  const hasDescription = Boolean(description || children);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Danger는 실수 방지로 취소에, 그 외는 확인에 초기 포커스
    const t = window.setTimeout(() => {
      (variant === 'danger' ? cancelRef : confirmRef).current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (loading) return;
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key === 'Enter' && !loading) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'TEXTAREA' || tag === 'BUTTON') return;
        e.preventDefault();
        onConfirmRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading]);

  function trapTab(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const nodes = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={hasDescription ? descId : undefined}
    >
      {/* Outside click */}
      <button
        type="button"
        className="absolute inset-0 bg-ink-950/40 animate-dialogBackdrop"
        aria-label="닫기"
        disabled={loading}
        onClick={() => {
          if (!loading) onCancel();
        }}
      />

      {/* Panel: 440px / radius 16 / padding 24 / fade+scale 200ms */}
      <div
        ref={panelRef}
        className={cn(
          'relative z-10 w-full rounded-2xl border border-ink-100 bg-[#fbfaf7] p-6 shadow-3 animate-dialogPanel',
          SIZE_CLASS[size],
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <h2 id={titleId} className="font-display text-lg text-ink-900">
          {title}
        </h2>

        {description ? (
          <p
            id={children ? undefined : descId}
            className="mt-2 text-sm leading-relaxed text-ink-600"
          >
            {description}
          </p>
        ) : null}

        {children ? (
          <div
            id={descId}
            className={cn(
              'text-sm leading-relaxed text-ink-600',
              description ? 'mt-3' : 'mt-2',
            )}
          >
            {children}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              if (!loading) onCancel();
            }}
          >
            {cancelText}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            disabled={loading}
            aria-busy={loading || undefined}
            onClick={() => {
              if (!loading) onConfirm();
            }}
            className={CONFIRM_CLASS[variant]}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {confirmText}
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
