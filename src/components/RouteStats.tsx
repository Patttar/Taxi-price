import { Clock, Route as RouteIcon, type LucideIcon } from 'lucide-react';

import type { Route } from '@/lib/geo';

function formatDistance(km: number) {
  return `${km.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км`;
}

function formatDuration(minutes: number) {
  const rounded = Math.max(Math.round(minutes), 1);
  const hours = Math.floor(rounded / 60);
  return hours > 0 ? `${hours} ч ${rounded % 60} мин` : `${rounded} мин`;
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg leading-tight font-bold">{value}</span>
        <span className="block text-xs text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

export default function RouteStats({ route }: { route: Route }) {
  return (
    <div className="flex divide-x divide-card rounded-2xl bg-accent">
      <Stat icon={RouteIcon} value={formatDistance(route.distanceKm)} label="расстояние" />
      <Stat icon={Clock} value={`≈ ${formatDuration(route.durationMin)}`} label="в пути" />
    </div>
  );
}
