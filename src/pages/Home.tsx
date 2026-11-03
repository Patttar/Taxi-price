import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { flushSync } from 'react-dom';
import { LoaderCircle, LocateFixed } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import PlaceDialog from '@/components/PlaceDialog';
import PlacesSheet from '@/components/PlacesSheet';
import RouteHistory from '@/components/RouteHistory';
import RouteMap from '@/components/RouteMap';
import RoutePoints, { type RoutePoint } from '@/components/RoutePoints';
import RouteStats from '@/components/RouteStats';
import SavedPlaces from '@/components/SavedPlaces';
import SheetHandle from '@/components/SheetHandle';
import ServiceList from '@/components/ServiceList';
import { fetchRoute, locateUser, type Place, type Route } from '@/lib/geo';
import { CITIES, findCity, getOffers } from '@/lib/prices';
import { addToRouteHistory, getRecentRoutes, loadRouteHistory } from '@/lib/routeHistory';
import {
  loadSavedPlaces,
  replaceSavedPlace,
  storeSavedPlaces,
  type SavedPlace,
} from '@/lib/savedPlaces';
import { useKeyboardInset } from '@/lib/useKeyboardInset';
import { useSwipeToClose } from '@/lib/useSwipeToClose';
import { cn } from '@/lib/utils';

type RouteResult = {
  key: string;
  route: Route | null;
};

type DialogState = {
  place: Place | null;
};

const HISTORY_DELAY_MS = 3000;
const APPLY_BAR_ID = 'apply-bar';

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

const HEADER_HEIGHT = 40;

// Положение без учёта сдвигов анимации: шторка ещё может выезжать, когда поле получает фокус.
function getPageTop(element: HTMLElement) {
  let top = 0;
  for (let node: HTMLElement | null = element; node; node = node.offsetParent as HTMLElement | null) {
    top += node.offsetTop;
  }
  return top;
}

// Экран стоит в верхней точке, пока поле там видно над клавиатурой и кнопкой «Показать цены».
function revealField(field: HTMLElement | null) {
  if (!field?.contains(document.activeElement)) return;

  const applyBarHeight = document.getElementById(APPLY_BAR_ID)?.offsetHeight ?? 0;
  const visibleHeight = (window.visualViewport?.height ?? window.innerHeight) - applyBarHeight;
  const top = getPageTop(field);
  if (top + field.offsetHeight <= visibleHeight) window.scrollTo(0, 0);
  else window.scrollTo(0, top - HEADER_HEIGHT);
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
  const [sheetMotion, setSheetMotion] = useState<'sheet-up' | 'sheet-down' | null>(null);
  const [isPlacesOpen, setIsPlacesOpen] = useState(false);
  const keyboardInset = useKeyboardInset();
  const hasTypedRef = useRef(false);
  const activeFieldRef = useRef<HTMLElement | null>(null);
  // Смахнутая шторка доезжает ровно до своего места на главном экране, поэтому сворачиваем без анимации.
  const { sheetRef, handleProps } = useSwipeToClose<HTMLElement>(
    () => collapse(false),
    () => `translateY(calc(48dvh - 2.25rem + ${window.scrollY}px))`,
  );

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
  const city = useMemo(() => (first ? findCity(first) : null), [first]);
  const offers = useMemo(
    () => (city && route && first && last ? getOffers(city, route, first, last) : []),
    [city, route, first, last],
  );
  const estimated = offers.filter(({ isEstimate }) => isEstimate).map(({ name }) => name);
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
    if (!isExpanded) setSheetMotion('sheet-up');
    setIsExpanded(true);
    // Поля встают на новое место только на следующем кадре после открытия шторки.
    requestAnimationFrame(() => requestAnimationFrame(() => revealField(field)));
  }

  function collapse(isAnimated = true) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    activeFieldRef.current = null;
    setSheetMotion(isAnimated ? 'sheet-down' : null);
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

  // Новое поле сразу получает фокус и открывает шторку ввода. Фокус ставим синхронно в обработчике
  // нажатия: иначе iPhone не покажет клавиатуру.
  function addStop() {
    const point = createPoint();
    flushSync(() => setPoints((current) => [...current.slice(0, -1), point, current.at(-1)!]));
    document.querySelector<HTMLInputElement>(`[data-point-key="${point.key}"] input`)?.focus();
  }

  function fillActiveField(place: Place) {
    const activeKey = Number(activeFieldRef.current?.dataset.pointKey);
    setPoints((current) => {
      const target = current.find(({ key }) => key === activeKey) ?? current.at(-1)!;
      return current.map((point) => (point === target ? { ...point, place } : point));
    });
  }

  function updateSavedPlaces(updated: SavedPlace[]) {
    setSavedPlaces(updated);
    storeSavedPlaces(updated);
  }

  function savePlace(saved: SavedPlace) {
    updateSavedPlaces(replaceSavedPlace(savedPlaces, saved));
    setDialog(null);
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
          className="absolute right-3 bottom-9 z-10 flex size-12 items-center justify-center rounded-full bg-card text-foreground shadow-md transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
        >
          {isLocating ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <LocateFixed className="size-5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div
          aria-hidden
          className="fixed inset-0 z-10 bg-black/50 animate-in fade-in-0 duration-300"
          onClick={() => collapse()}
        />
      )}

      <main
        ref={sheetRef}
        onAnimationEnd={(event) => event.target === event.currentTarget && setSheetMotion(null)}
        className={cn(
          'relative z-20 mx-auto flex max-w-xl flex-col gap-4 rounded-t-3xl bg-background px-4',
          sheetMotion,
          isExpanded
            ? 'mt-3 min-h-[calc(100dvh-0.75rem)] pb-[70dvh]'
            : 'mt-[calc(48dvh-1.5rem)] min-h-[calc(52dvh+1.5rem)] pt-5 pb-8',
        )}
      >
        {isExpanded && (
          <div
            {...handleProps}
            className="sticky top-0 z-20 -mx-4 -mb-2 touch-none rounded-t-3xl bg-background px-4 pt-1.5 pb-1"
          >
            <SheetHandle label="Свернуть" onClick={() => collapse()} />
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
            <RouteStats route={route} cityName={city?.name} />
            {hasStops && offers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Остановки добавьте в заказ сами, ожидание в цене не учтено.
              </p>
            )}
            {city ? (
              <>
                <ServiceList offers={offers} />
                <p className="text-xs text-muted-foreground">
                  Цены примерные, без «горячих часов».
                  {estimated.length > 0 &&
                    ` У ${estimated.join(' и ')} тариф условный: они его не публикуют.`}
                </p>
              </>
            ) : (
              <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                Здесь мы пока не знаем цен такси. Сейчас считаем для городов:{' '}
                {CITIES.map(({ name }) => name).join(', ')}.
              </p>
            )}
          </>
        )}

        {(isExpanded || (!route && !isLoading)) && (
          <>
            {isExpanded && (
              <SavedPlaces
                places={savedPlaces}
                onSelect={({ place }) => fillActiveField(place)}
                onAdd={() => setDialog({ place: null })}
                onOpenAll={() => setIsPlacesOpen(true)}
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

      {isExpanded && routeKey && (
        <div
          id={APPLY_BAR_ID}
          className="fixed inset-x-0 z-30 bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in-0 slide-in-from-bottom-4"
          style={{ bottom: keyboardInset }}
        >
          <button
            type="button"
            onClick={() => collapse()}
            className="mx-auto block h-12 w-full max-w-xl rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Показать цены
          </button>
        </div>
      )}

      {isPlacesOpen && (
        <PlacesSheet
          places={savedPlaces}
          onChange={updateSavedPlaces}
          onClose={() => setIsPlacesOpen(false)}
        />
      )}

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
