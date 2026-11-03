import { Clock, MapPin, Route as RouteIcon } from 'lucide-react';

import type { Route } from '@/lib/geo';

function formatDistance(km: number) {
  return `${km.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км`;
}

function formatDuration(minutes: number) {
  const rounded = Math.max(Math.round(minutes), 1);
  const hours = Math.floor(rounded / 60);
  return hours > 0 ? `${hours} ч ${rounded % 60} мин` : `${rounded} мин`;
}

// Второстепенная строка: город, по тарифам которого считаем, расстояние и время.
export default function RouteStats({ route, cityName }: { route: Route; cityName?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {cityName && (
        <span className="flex items-center gap-1.5">
          <MapPin className="size-4" />
          {cityName}
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <RouteIcon className="size-4" />
        {formatDistance(route.distanceKm)}
      </span>
      <span className="flex items-center gap-1.5">
        <Clock className="size-4" />≈ {formatDuration(route.durationMin)}
      </span>
    </p>
  );
}
