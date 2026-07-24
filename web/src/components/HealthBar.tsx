import { Activity, Database, HardDrive, Radio } from 'lucide-react';
import type { HealthPayload } from '../types';

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        ok ? 'bg-teal-600' : 'bg-rose-500'
      }`}
    />
  );
}

export function HealthBar({
  health,
  apiKey,
  onApiKeyChange,
}: {
  health: HealthPayload | null;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
}) {
  const info = health?.info;
  const items = [
    {
      label: 'Postgres',
      ok: info?.postgres?.status === 'up',
      icon: Database,
    },
    {
      label: 'Redis',
      ok: info?.redis?.status === 'up',
      icon: Radio,
    },
    {
      label: 'Elastic',
      ok: info?.elasticsearch?.status === 'up',
      icon: HardDrive,
    },
    {
      label: 'API',
      ok: Boolean(health),
      icon: Activity,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 justify-between">
      <div className="flex flex-wrap items-center gap-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 text-sm text-ink-700"
          >
            <item.icon className="h-3.5 w-3.5 text-ink-500" />
            <Dot ok={item.ok} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-500">
        API Key
        <input
          className="w-48 rounded-md border border-ink-100 bg-white/80 px-2 py-1.5 text-ink-900 outline-none focus:border-teal-600"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          spellCheck={false}
        />
      </label>
    </div>
  );
}
