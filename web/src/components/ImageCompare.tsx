import { useCallback, useRef, useState } from 'react';
import { Blend, Columns2, Minus, Plus, SquareSplitHorizontal } from 'lucide-react';

type CompareMode = 'side' | 'overlay' | 'ba';

function Frame({
  label,
  src,
  scale,
  empty,
}: {
  label: string;
  src: string | null;
  scale: number;
  empty: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500">
        {label}
      </p>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sand-100 ring-1 ring-ink-100">
        {src ? (
          <img
            src={src}
            alt=""
            className="h-full w-full object-contain transition-transform duration-150"
            style={{ transform: `scale(${scale})` }}
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs text-ink-300">
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 렌탈 상품 vs 검색 결과 이미지 비교
 * - 좌우 / Overlay / Before·After
 * - 확대·축소
 */
export function ImageCompare({
  rentalSrc,
  resultSrc,
}: {
  rentalSrc: string | null;
  resultSrc: string | null;
}) {
  const [mode, setMode] = useState<CompareMode>('side');
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(50);
  const [wipe, setWipe] = useState(50);
  const baRef = useRef<HTMLDivElement>(null);

  const zoomIn = () => setScale((s) => Math.min(3, Math.round((s + 0.25) * 100) / 100));
  const zoomOut = () => setScale((s) => Math.max(0.5, Math.round((s - 0.25) * 100) / 100));

  const onBaPointer = useCallback((clientX: number) => {
    const el = baRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setWipe(Math.max(0, Math.min(100, pct)));
  }, []);

  const modes: { id: CompareMode; label: string; icon: typeof Columns2 }[] = [
    { id: 'side', label: '좌우', icon: Columns2 },
    { id: 'overlay', label: 'Overlay', icon: Blend },
    { id: 'ba', label: 'Before/After', icon: SquareSplitHorizontal },
  ];

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-ink-100 bg-sand-50 p-0.5">
          {modes.map((m) => {
            const Icon = m.icon;
            const on = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  on
                    ? 'bg-ink-900 text-sand-50'
                    : 'text-ink-600 hover:bg-white'
                }`}
              >
                <Icon className="h-3 w-3" />
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            className="rounded-lg border border-ink-100 bg-sand-50 p-1.5 text-ink-700 hover:bg-sand-100"
            aria-label="축소"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-ink-500">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            className="rounded-lg border border-ink-100 bg-sand-50 p-1.5 text-ink-700 hover:bg-sand-100"
            aria-label="확대"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {mode === 'side' ? (
        <div className="mt-3 flex gap-2">
          <Frame
            label="렌탈 상품"
            src={rentalSrc}
            scale={scale}
            empty="렌탈 이미지 없음"
          />
          <div className="flex shrink-0 items-center self-center px-0.5 text-[10px] font-semibold tracking-wide text-ink-400">
            VS
          </div>
          <Frame
            label="검색 결과"
            src={resultSrc}
            scale={scale}
            empty="검색 이미지 없음"
          />
        </div>
      ) : null}

      {mode === 'overlay' ? (
        <div className="mt-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sand-100 ring-1 ring-ink-100">
            {rentalSrc ? (
              <img
                src={rentalSrc}
                alt="렌탈"
                className="absolute inset-0 h-full w-full object-contain transition-transform duration-150"
                style={{ transform: `scale(${scale})` }}
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-300">
                렌탈 이미지 없음
              </div>
            )}
            {resultSrc ? (
              <img
                src={resultSrc}
                alt="검색"
                className="absolute inset-0 h-full w-full object-contain transition-transform duration-150"
                style={{
                  transform: `scale(${scale})`,
                  opacity: opacity / 100,
                }}
                draggable={false}
              />
            ) : null}
            <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] text-ink-600">
              렌탈
            </div>
            <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] text-ink-600">
              검색 {opacity}%
            </div>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-ink-500">
            Overlay
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="flex-1 accent-teal-700"
            />
          </label>
        </div>
      ) : null}

      {mode === 'ba' ? (
        <div className="mt-3">
          <div
            ref={baRef}
            className="relative aspect-[4/3] cursor-ew-resize overflow-hidden rounded-xl bg-sand-100 ring-1 ring-ink-100 select-none"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              onBaPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 0) return;
              onBaPointer(e.clientX);
            }}
          >
            {resultSrc ? (
              <img
                src={resultSrc}
                alt="검색"
                className="absolute inset-0 h-full w-full object-contain transition-transform duration-150"
                style={{ transform: `scale(${scale})` }}
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-300">
                검색 이미지 없음
              </div>
            )}
            <div
              className="absolute inset-0"
              style={{
                clipPath: `inset(0 ${100 - wipe}% 0 0)`,
              }}
            >
              {rentalSrc ? (
                <img
                  src={rentalSrc}
                  alt="렌탈"
                  className="absolute inset-0 h-full w-full object-contain transition-transform duration-150"
                  style={{ transform: `scale(${scale})` }}
                  draggable={false}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-sand-100/80 text-xs text-ink-300">
                  렌탈 이미지 없음
                </div>
              )}
            </div>
            <div
              className="absolute inset-y-0 z-10 w-0.5 bg-teal-700"
              style={{ left: `${wipe}%` }}
            >
              <div className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-teal-700 bg-white shadow-soft" />
            </div>
            <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] text-ink-600">
              Before · 렌탈
            </div>
            <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] text-ink-600">
              After · 검색
            </div>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-ink-500">
            Before / After
            <input
              type="range"
              min={0}
              max={100}
              value={wipe}
              onChange={(e) => setWipe(Number(e.target.value))}
              className="flex-1 accent-teal-700"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
