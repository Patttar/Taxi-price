import { useEffect, useRef, useState } from 'react';

import { DEFAULT_LOCATION, type Place, type Route } from '@/lib/geo';
import { loadYandexMaps } from '@/lib/yandexMaps';

const FROM_COLOR = '#1e9a4b';
const TO_COLOR = '#e5484d';
const ROUTE_COLOR = '#dcff00';
const ROUTE_OUTLINE_COLOR = '#17181a';
const SINGLE_POINT_ZOOM = 15;

type Props = {
  points: Place[];
  route: Route | null;
};

export default function RouteMap({ points, route }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<ymaps.Map | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current!;
    let isCancelled = false;
    let created: ymaps.Map | undefined;
    let observer: ResizeObserver | undefined;

    loadYandexMaps()
      .then((api) => {
        if (isCancelled) return;
        created = new api.Map(
          container,
          { center: [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon], zoom: 13, controls: [] },
          { suppressMapOpenBlock: true },
        );
        observer = new ResizeObserver(() => created?.container.fitToViewport());
        observer.observe(container);
        setMap(created);
      })
      .catch(() => {
        if (!isCancelled) setHasFailed(true);
      });

    return () => {
      isCancelled = true;
      observer?.disconnect();
      created?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    map.geoObjects.removeAll();

    if (route) {
      map.geoObjects.add(
        new ymaps.Polyline(route.path, {}, {
          // Лаймовая линия без обводки теряется на жёлтых дорогах карты.
          strokeColor: [ROUTE_OUTLINE_COLOR, ROUTE_COLOR],
          strokeWidth: [8, 4],
        }),
      );
    }

    points.forEach((place, index) => {
      const isStop = index > 0 && index < points.length - 1;
      map.geoObjects.add(
        new ymaps.Placemark(
          [place.lat, place.lon],
          isStop ? { iconContent: index } : {},
          isStop
            ? { preset: 'islands#circleIcon', iconColor: ROUTE_OUTLINE_COLOR }
            : {
                preset: 'islands#circleDotIcon',
                iconColor: index === 0 ? FROM_COLOR : TO_COLOR,
              },
        ),
      );
    });

    if (points.length === 1) {
      const [{ lat, lon }] = points;
      map.setCenter([lat, lon], SINGLE_POINT_ZOOM, { duration: 300 });
    } else if (points.length > 1) {
      map.setBounds(map.geoObjects.getBounds()!, {
        checkZoomRange: true,
        duration: 300,
        zoomMargin: [48, 40, 72, 40],
      });
    }
  }, [map, points, route]);

  return (
    <div ref={containerRef} className="isolate size-full bg-muted">
      {hasFailed && (
        <p className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Не удалось загрузить карту
        </p>
      )}
    </div>
  );
}
