import {
  useEffect,
  useId,
  useLayoutEffect,
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

const MENU_WIDTH = 180;
const VIEWPORT_PAD = 8;
const GAP = 6;

function placeMenu(
  trigger: DOMRect,
  menuSize: { width: number; height: number },
  align: 'start' | 'end',
) {
  const width = Math.max(menuSize.width, MENU_WIDTH);
  const height = menuSize.height;
  let left =
    align === 'end'
      ? Math.min(trigger.right - width, window.innerWidth - width - VIEWPORT_PAD)
      : Math.max(VIEWPORT_PAD, trigger.left);
  left = Math.max(
    VIEWPORT_PAD,
    Math.min(left, window.innerWidth - width - VIEWPORT_PAD),
  );

  const spaceBelow = window.innerHeight - trigger.bottom - VIEWPORT_PAD;
  const spaceAbove = trigger.top - VIEWPORT_PAD;
  const openUp = spaceBelow < height && spaceAbove > spaceBelow;

  let top = openUp ? trigger.top - height - GAP : trigger.bottom + GAP;
  top = Math.max(
    VIEWPORT_PAD,
    Math.min(top, window.innerHeight - height - VIEWPORT_PAD),
  );

  return { top, left };
}

/**
 * 경량 Dropdown Menu — More(⋯) 액션용
 * 뷰포트 밖으로 나가면 위/아래로 뒤집어 붙인다.
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
    // 실제 높이 측정 전 추정 배치 (아이템당 ~36px + padding)
    const estimatedHeight = items.length * 36 + 8;
    setCoords(
      placeMenu(rect, { width: MENU_WIDTH, height: estimatedHeight }, align),
    );
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open || !menuRef.current || !triggerRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    setCoords(
      placeMenu(
        trigger,
        { width: menu.width, height: menu.height },
        align,
      ),
    );
  }, [open, align, items.length]);

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
    const onReposition = () => {
      if (!triggerRef.current || !menuRef.current) return;
      const trigger = triggerRef.current.getBoundingClientRect();
      const menu = menuRef.current.getBoundingClientRect();
      setCoords(
        placeMenu(
          trigger,
          { width: menu.width, height: menu.height },
          align,
        ),
      );
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, align]);

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
