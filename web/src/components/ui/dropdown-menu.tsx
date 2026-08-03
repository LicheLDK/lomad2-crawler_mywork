import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

export type DropdownMenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
};

/**
 * 경량 Dropdown Menu — More(⋯) 액션용
 */
export function DropdownMenu({
  trigger,
  items,
  align = 'end',
  disabled = false,
  'aria-label': ariaLabel = '더보기',
}: {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: 'start' | 'end';
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function openMenu() {
    if (disabled) return;
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 180;
    const left =
      align === 'end'
        ? Math.min(rect.right - width, window.innerWidth - width - 8)
        : Math.max(8, rect.left);
    setCoords({
      top: rect.bottom + 6,
      left: Math.max(8, left),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t))
        return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])',
    );
    first?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) setOpen(false);
          else openMenu();
        }}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-ink-100 bg-white/90 text-ink-500 transition hover:border-ink-200 hover:bg-sand-50 hover:text-ink-800 disabled:opacity-50"
      >
        {trigger}
      </button>
      {open && coords && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              className="fixed z-[10001] min-w-[180px] overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-2 animate-dialogPanel"
              style={{ top: coords.top, left: coords.left }}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  aria-disabled={item.disabled || undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (item.disabled) return;
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition focus:outline-none focus:bg-sand-50',
                    item.danger
                      ? 'text-rose-700 hover:bg-rose-50'
                      : 'text-ink-800 hover:bg-sand-50',
                    item.disabled && 'cursor-not-allowed opacity-40',
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
