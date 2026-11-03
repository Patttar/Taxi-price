import { useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { RouteRow } from '@/components/RouteHistory';
import { normalize } from '@/lib/geo';
import { loadRouteHistory, type SavedRoute } from '@/lib/routeHistory';

const DAY_FORMAT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const TIME_FORMAT = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

function formatDay(at: number) {
  const day = new Date(at).toDateString();
  const today = new Date();
  if (day === today.toDateString()) return 'Сегодня';

  today.setDate(today.getDate() - 1);
  return day === today.toDateString() ? 'Вчера' : DAY_FORMAT.format(at);
}

function groupByDay(routes: SavedRoute[]) {
  const days = new Map<string, SavedRoute[]>();
  for (const route of routes) {
    const day = formatDay(route.at);
    days.set(day, [...(days.get(day) ?? []), route]);
  }
  return [...days];
}

function matches({ points }: SavedRoute, query: string) {
  const text = normalize(points.map(({ title }) => title).join(' '));
  return normalize(query)
    .split(/[\s,]+/)
    .every((word) => text.includes(word));
}

export default function History() {
  const navigate = useNavigate();
  const [history] = useState(loadRouteHistory);
  const [query, setQuery] = useState('');

  const found = history.filter((route) => matches(route, query.trim()));

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 pt-4 pb-8">
      <header className="flex items-center gap-1">
        <Link
          to="/"
          aria-label="Назад"
          className="-ml-2 flex size-10 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">История маршрутов</h1>
      </header>

      <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3 ring-ring/50 focus-within:ring-2">
        <Search className="size-5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          placeholder="Поиск по адресу"
          aria-label="Поиск по адресу"
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
        />
        {query && (
          <button
            type="button"
            aria-label="Очистить поиск"
            onClick={() => setQuery('')}
            className="-mr-2 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" />
          </button>
        )}
      </label>

      {found.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {history.length === 0 ? 'За последний месяц маршрутов не было' : 'Ничего не нашлось'}
        </p>
      )}

      {groupByDay(found).map(([day, routes]) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="text-sm text-muted-foreground">{day}</h2>
          <ul className="flex flex-col gap-2">
            {routes.map((route) => (
              <li key={route.at}>
                <RouteRow
                  route={route}
                  time={TIME_FORMAT.format(route.at)}
                  onSelect={({ points }) => navigate('/', { state: { points } })}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
