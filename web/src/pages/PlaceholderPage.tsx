export function PlaceholderPage({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="animate-fadeUp rounded-2xl border border-ink-100/80 bg-white/60 px-6 py-16 text-center shadow-soft">
      <p className="text-xs uppercase tracking-[0.18em] text-ink-500">{eyebrow}</p>
      <p className="mt-2 font-display text-2xl text-ink-900">{title}</p>
      <p className="mt-2 text-sm text-ink-500">
        다음 단계에서 화면을 구성합니다.
      </p>
    </div>
  );
}
