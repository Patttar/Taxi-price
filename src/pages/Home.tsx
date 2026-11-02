import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { ArrowLeft, LoaderCircle, LocateFixed } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import PlaceDialog from '@/components/PlaceDialog';
import RouteHistory from '@/components/RouteHistory';
import RouteMap from '@/components/RouteMap';
import RoutePoints, { type RoutePoint } from '@/components/RoutePoints';
import RouteStats from '@/components/RouteStats';
import SavedPlaces from '@/components/SavedPlaces';
import ServiceList from '@/components/ServiceList';
import { fetchRoute, locateUser, type Place, type Route } from '@/lib/geo';
import { getOffers } from '@/lib/prices';
import { addToRouteHistory, getRecentRoutes, loadRouteHistory } from '@/lib/routeHistory';
import {
  loadSavedPlaces,
  replaceSavedPlace,
  storeSavedPlaces,
  type SavedPlace,
} from '@/lib/savedPlaces';
import { useKeyboardInset } from '@/lib/useKeyboardInset';
import { cn } from '@/lib/utils';

type RouteResult = {
  key: string;
  route: Route | null;
};

type DialogState = {
  place: Place | null;
};

const HISTORY_DELAY_MS = 3000;
const APPLY_BAR_HEIGHT = 76;

let nextPointKey = 0;

function createPoint(place: Place | null = null): RoutePoint {
  nextPointKey += 1;
  return { key: nextPointKey, place };
}

function getLocationError(error: GeolocationPositionError | Error) {
  return 'code' in error && error.code === error.PERMISSION_DENIED
    ? 'Нет доступа к местоположению. Разрешите его в настройках браузера.'
    : 'Не удалось определить местоположение. Попробуйте ещё раз.';
}

// Экран стоит в верхней точке, пока поле там видно над клавиатурой и кнопкой.
function revealField(field: HTMLElement | null) {
  if (!field?.contains(document.activeElement)) return;

  const visibleHeight = (window.visualViewport?.height ?? window.innerHeight) - APPLY_BAR_HEIGHT;
  const bottomFromTop = field.getBoundingClientRect().bottom + window.scrollY;
  if (bottomFromTop <= visibleHeight) window.scrollTo(0, 0);
  else field.scrollIntoView({ block: 'start' });
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
  const [isExpanded, setIsExpanded] = useState(false);
  const keyboardInset = useKeyboardInset();
  const hasTypedRef = useRef(false);
  const activeFieldRef = useRef<HTMLElement | null>(null);

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
      .catch((error) => {
        if (!isCancelled) setLocationError(getLocationError(error));
      })
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
    if (!route || isExpanded) return;

    const timer = setTimeout(() => {
      setHistory((current) => addToRouteHistory(current, JSON.parse(routeKey) as Place[]));
    }, HISTORY_DELAY_MS);

    return () => clearTimeout(timer);
  }, [route, routeKey, isExpanded]);

  // Клавиатура телефона появляется уже после фокуса и сдвигает видимую область.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!isExpanded || !viewport) return;

    const reveal = () => revealField(activeFieldRef.current);
    viewport.addEventListener('resize', reveal);
    return () => viewport.removeEventListener('resize', reveal);
  }, [isExpanded]);

  function handleFieldFocus(event: FocusEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLInputElement)) return;

    const field = event.target.closest('li');
    activeFieldRef.current = field;
    setIsExpanded(true);
    // Поля встают на новое место только на следующем кадре после открытия шторки.
    requestAnimationFrame(() => requestAnimationFrame(() => revealField(field)));
  }

  function collapse() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    activeFieldRef.current = null;
    setIsExpanded(false);
    window.scrollTo(0, 0);
  }

  function locate() {
    setLocationError('');
    setIsLocating(true);
    locateUser()
      .then((place) => {
        setPoints((current) => [{ ...current[0], place }, ...current.slice(1)]);
      })
      .catch((error) => setLocationError(getLocationError(error)))
      .finally(() => setIsLocating(false));
  }

  function addStop() {
    setPoints((current) => [...current.slice(0, -1), createPoint(), current.at(-1)!]);
  }

  function fillActiveField(place: Place) {
    const activeKey = Number(activeFieldRef.current?.dataset.pointKey);
    setPoints((current) => {
      const target = current.find(({ key }) => key === activeKey) ?? current.at(-1)!;
      return current.map((point) => (point === target ? { ...point, place } : point));
    });
  }

  function savePlace(saved: SavedPlace) {
    const updated = replaceSavedPlace(savedPlaces, saved);
    setSavedPlaces(updated);
    storeSavedPlaces(updated);
    setDialog(null);
  }

  return (
    <>
      <div className={cn('fixed inset-x-0 top-0 h-[48dvh]', isExpanded && 'invisible')}>
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

      <main
        className={cn(
          'relative z-20 mx-auto flex max-w-xl flex-col gap-4 bg-background px-4',
          isExpanded
            ? 'min-h-dvh pb-[70dvh]'
            : 'mt-[calc(48dvh-1.5rem)] min-h-[calc(52dvh+1.5rem)] rounded-t-3xl pt-5 pb-8',
        )}
      >
        {isExpanded && (
          <div className="sticky top-0 z-20 -mx-4 bg-background px-2 py-2">
            <button
              type="button"
              aria-label="Свернуть"
              onClick={collapse}
              className="flex size-10 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-5" />
            </button>
          </div>
        )}

        <div onFocus={handleFieldFocus}>
          <RoutePoints
            points={points}
            isLocating={isLocating}
            isExpanded={isExpanded}
            near={first ?? undefined}
            savedPlaces={savedPlaces}
            onChange={setPoints}
            onAdd={addStop}
            onSave={(place) => setDialog({ place })}
            onFirstFieldInput={() => {
              hasTypedRef.current = true;
            }}
          />
        </div>

        {locationError && <p className="text-sm text-destructive">{locationError}</p>}

        {isLoading && !isExpanded && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Строим маршрут…
          </p>
        )}

        {hasFailed && !isExpanded && (
          <p className="text-sm text-destructive">
            Не удалось построить маршрут между этими адресами. Проверьте адреса или попробуйте позже.
          </p>
        )}

        {route && !isExpanded && (
          <>
            <RouteStats route={route} />
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

        {(isExpanded || (!route && !isLoading)) && (
          <>
            {isExpanded && savedPlaces.length > 0 && (
              <SavedPlaces
                places={savedPlaces}
                onSelect={({ place }) => fillActiveField(place)}
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

        {isExpanded && (
          <div
            className="fixed inset-x-0 z-[5] bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
            style={{ bottom: keyboardInset }}
          >
            <button
              type="button"
              disabled={!routeKey}
              onClick={collapse}
              className="mx-auto block h-12 w-full max-w-xl rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-opacity focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Показать цены
            </button>
          </div>
        )}
      </main>

      {dialog && (
        <PlaceDialog
          initialPlace={dialog.place}
          places={savedPlaces}
          onSave={savePlace}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
