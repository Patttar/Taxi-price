import type { Place } from './geo';

export type SavedRoute = { points: Place[]; at: number };

type StoredRoute = Partial<SavedRoute> & { from?: Place; to?: Place };

const STORAGE_KEY = 'taxi.route-history';
const RECENT_LIMIT = 3;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

function getRouteKey({ points }: SavedRoute) {
  return points.map(({ title }) => title).join('|');
}

function keepLastMonth(routes: SavedRoute[]) {
  const oldest = Date.now() - KEEP_MS;
  return routes.filter(({ at }) => at >= oldest);
}

export function loadRouteHistory(): SavedRoute[] {
  try {
    const saved: StoredRoute[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];

    // Старые записи хранились как { from, to } и без даты.
    const routes = saved.map(({ points, at, from, to }) => ({
      points: points ?? [from!, to!],
      at: at ?? Date.now(),
    }));
    return keepLastMonth(routes);
  } catch {
    return [];
  }
}

export function addToRouteHistory(history: SavedRoute[], points: Place[]): SavedRoute[] {
  const route = { points, at: Date.now() };
  const isRepeat = history[0] && getRouteKey(history[0]) === getRouteKey(route);
  const updated = keepLastMonth([route, ...(isRepeat ? history.slice(1) : history)]);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Без хранилища история просто живёт до перезагрузки страницы.
  }
  return updated;
}

export function getRecentRoutes(history: SavedRoute[]) {
  const seen = new Set<string>();
  return history
    .filter((route) => {
      const key = getRouteKey(route);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, RECENT_LIMIT);
}
