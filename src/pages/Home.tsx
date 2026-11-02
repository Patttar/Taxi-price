import { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle, LocateFixed } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import PlaceDialog from '@/components/PlaceDialog';
import RouteHistory from '@/components/RouteHistory';
import RouteMap from '@/components/RouteMap';
import RoutePoints, { type RoutePoint } from '@/components/RoutePoints';
import SavedPlaces from '@/components/SavedPlaces';
import ServiceList from '@/components/ServiceList';
import { fetchRoute, locateUser, type Place, type Route } from '@/lib/geo';
import { getOffers } from '@/lib/prices';
import { addToRouteHistory, getRecentRoutes, loadRouteHistory } from '@/lib/routeHistory';
import { loadSavedPlaces, storeSavedPlaces, type SavedPlace } from '@/lib/savedPlaces';

type RouteResult = {
  key: string;
  route: Route | null;
};

type DialogState = {
  name?: string;
  place: Place | null;
};

const HISTORY_DELAY_MS = 3000;

let nextPointKey = 0;

function createPoint(place: Place | null = null): RoutePoint {
  nextPointKey += 1;
  return { key: nextPointKey, place };
}

function formatDuration(minutes: number) {
  const rounded = Math.max(Math.round(minutes), 1);
  const hours = Math.floor(rounded / 60);
  return hours > 0 ? `${hours} ч ${rounded % 60} мин` : `${rounded} мин`;
}

export default function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const restoredPlaces = location.state?.points as Place[] | undefined;

  const [points, setPoints] = useState<RoutePoint[]>(() =>
    restoredPlaces ? restoredPlaces.map(createPoint) : [createPoint(), createPoint()],
  );
  const [shouldLocate] = useState(!restoredPlaces);
  const [isLocating, setIsLocating] = useState(shouldLocate);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [locationError, setLocationError] = useState('');
  const [history, setHistory] = useState(loadRouteHistory);
  const [savedPlaces, setSavedPlaces] = useState(loadSavedPlaces);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const hasTypedRef = useRef(false);

  const places = useMemo(() => points.flatMap(({ place }) => (place ? [place] : [])), [points]);
  const first = points[0].place;
  const last = points.at(-1)!.place;
  const routeKey = first && last ? JSON.stringify(places) : '';

  useEffect(() => {
    if (location.state) navigate('.', { replace: true, state: null });
  }, [location.state, navigate]);

  useEffect(() => {
    if (!shouldLocate) return;

    let isCancelled = false;
    locateUser()
      .then((place) => {
        if (isCancelled || hasTypedRef.current) return;
        setPoints((current) =>
          current[0].place
            ? current
            : [{ ...current[0], place }, ...current.slice(1)],
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!isCancelled) setIsLocating(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [shouldLocate]);

  useEffect(() => {
    if (!routeKey) return;

    const routePlaces = JSON.parse(routeKey) as Place[];
    const controller = new AbortController();
    fetchRoute(routePlaces, controller.signal)
      .then((route) => setResult({ key: routeKey, route }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: routeKey, route: null });
      });

    return () => controller.abort();
  }, [routeKey]);

  const isCurrent = routeKey !== '' && result?.key === routeKey;
  const route = isCurrent ? result.route : null;
  const isLoading = routeKey !== '' && !isCurrent;
  const hasFailed = isCurrent && !route;
  const hasStops = places.length > 2;
  const offers = useMemo(
    () => (route && first && last ? getOffers(route, first, last) : []),
    [route, first, last],
  );
  const recentRoutes = useMemo(() => getRecentRoutes(history), [history]);

  // Промежуточные варианты при перетаскивании и правке адресов в историю не попадают.
  useEffect(() => {
    if (!route) return;

    const timer = setTimeout(() => {
      setHistory((current) => addToRouteHistory(current, JSON.parse(routeKey) as Place[]));
    }, HISTORY_DELAY_MS);

    return () => clearTimeout(timer);
  }, [route, routeKey]);

  function locate() {
    setLocationError('');
    setIsLocating(true);
    locateUser()
      .then((place) => {
        setPoints((current) => [{ ...current[0], place }, ...current.slice(1)]);
      })
      .catch((error: GeolocationPositionError | Error) => {
        setLocationError(
          'code' in error && error.code === error.PERMISSION_DENIED
            ? 'Нет доступа к местоположению. Разрешите его в настройках браузера.'
            : 'Не удалось определить местоположение. Попробуйте ещё раз.',
        );
      })
      .finally(() => setIsLocating(false));
  }

  function addStop() {
    setPoints((current) => [...current.slice(0, -1), createPoint(), current.at(-1)!]);
  }

  function goTo(place: Place) {
    setPoints((current) => [...current.slice(0, -1), { ...current.at(-1)!, place }]);
  }

  function updateSavedPlaces(updated: SavedPlace[]) {
    setSavedPlaces(updated);
    storeSavedPlaces(updated);
    setDialog(null);
  }

  function savePlace(saved: SavedPlace) {
    const others = savedPlaces.filter(({ name }) => name !== saved.name && name !== dialog?.name);
    updateSavedPlaces([...others, saved]);
  }

  function openPlaceDialog(place: Place) {
    const saved = savedPlaces.find((item) => item.place.title === place.title);
    setDialog({ name: saved?.name, place: saved?.place ?? place });
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 h-[48dvh]">
        <RouteMap points={places} route={route} />
        <button
          type="button"
          aria-label="Найти моё местоположение"
          title="Найти моё местоположение"
          disabled={isLocating}
          onClick={locate}
          className="absolute right-3 bottom-9 z-10 flex size-12 items-center justify-center rounded-full bg-card text-primary shadow-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
        >
          {isLocating ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <LocateFixed className="size-5" />
          )}
        </button>
      </div>

      <main className="relative z-20 mx-auto mt-[calc(48dvh-1.5rem)] flex min-h-[calc(52dvh+1.5rem)] max-w-xl flex-col gap-4 rounded-t-3xl bg-background px-4 pt-5 pb-8">
        <div
          onInput={() => {
            hasTypedRef.current = true;
          }}
        >
          <RoutePoints
            points={points}
            isLocating={isLocating}
            near={first ?? undefined}
            savedPlaces={savedPlaces}
            onChange={setPoints}
            onAdd={addStop}
            onSave={openPlaceDialog}
          />
        </div>

        {locationError && <p className="text-sm text-destructive">{locationError}</p>}

        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Строим маршрут…
          </p>
        )}

        {hasFailed && (
          <p className="text-sm text-destructive">
            Не удалось построить маршрут между этими адресами. Проверьте адреса или попробуйте позже.
          </p>
        )}

        {route && (
          <>
            <p className="text-sm font-medium">
              {route.distanceKm.toFixed(1)} км · примерно {formatDuration(route.durationMin)} в пути
            </p>
            {hasStops && (
              <p className="text-sm text-muted-foreground">
                Остановки в заказ не передаются: добавьте их в приложении сервиса или скажите
                диспетчеру. Ожидание на остановках в цене не учтено.
              </p>
            )}
            <ServiceList offers={offers} />
            <p className="text-xs text-muted-foreground">
              Цены примерные. У Яндекс Go расчёт по опубликованному тарифу без «горячих часов», у
              остальных условный: своих тарифов они не публикуют. Точную цену назовёт сервис.
            </p>
          </>
        )}

        {!route && !isLoading && (
          <>
            {savedPlaces.length > 0 && (
              <SavedPlaces
                places={savedPlaces}
                onSelect={({ place }) => goTo(place)}
                onEdit={setDialog}
                onAdd={() => setDialog({ place: null })}
              />
            )}
            {recentRoutes.length > 0 && (
              <RouteHistory
                routes={recentRoutes}
                onSelect={(saved) => setPoints(saved.points.map(createPoint))}
              />
            )}
          </>
        )}
      </main>

      {dialog && (
        <PlaceDialog
          initialName={dialog.name}
          initialPlace={dialog.place}
          places={savedPlaces}
          onSave={savePlace}
          onDelete={() =>
            updateSavedPlaces(savedPlaces.filter(({ name }) => name !== dialog.name))
          }
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
