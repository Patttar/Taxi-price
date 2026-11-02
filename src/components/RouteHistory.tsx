import { ChevronRight, History } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { SavedRoute } from '@/lib/routeHistory';
import { cn } from '@/lib/utils';

type RowProps = {
  route: SavedRoute;
  time?: string;
  className?: string;
  onSelect: (route: SavedRoute) => void;
};

function formatStops(count: number) {
  if (count === 1) return '1 остановка';
  return `${count} остановки`;
}

export function RouteRow({ route, time, className, onSelect }: RowProps) {
  const { points } = route;
  const stops = points.length - 2;

  return (
    <button
      type="button"
      onClick={() => onSelect(route)}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <History className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{points[0].title}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {points.at(-1)!.title}
        </span>
        {stops > 0 && (
          <span className="block text-xs text-muted-foreground">{formatStops(stops)}</span>
        )}
      </span>
      {time ? (
        <span className="shrink-0 text-xs text-muted-foreground">{time}</span>
      ) : (
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

type Props = {
  routes: SavedRoute[];
  onSelect: (route: SavedRoute) => void;
};

export default function RouteHistory({ routes, onSelect }: Props) {
  return (
    <section className="flex flex-col rounded-2xl bg-muted py-2">
      <Link
        to="/history"
        aria-label="Все маршруты"
        className="flex items-center justify-between gap-3 rounded-lg px-4 py-1.5 text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <h2 className="text-sm">Недавние маршруты</h2>
        <ChevronRight className="size-5 shrink-0" />
      </Link>
      <ul className="flex flex-col">
        {routes.map((route) => (
          <li key={route.at}>
            <RouteRow
              route={route}
              className="rounded-none bg-transparent py-2.5"
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
