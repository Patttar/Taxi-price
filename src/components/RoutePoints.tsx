import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Reorder, useDragControls, type DragControls } from 'framer-motion';
import { GripVertical, MapPin, Trash2 } from 'lucide-react';

import AddressInput from '@/components/AddressInput';
import type { Coordinates, Place } from '@/lib/geo';
import type { SavedPlace } from '@/lib/savedPlaces';
import { cn } from '@/lib/utils';

export type RoutePoint = { key: number; place: Place | null };

const MAX_POINTS = 5;
const LONG_PRESS_MS = 350;
const PRESS_TOLERANCE = 8;

// Мышью тянут сразу. Пальцем — после долгого нажатия, чтобы случайное касание при прокрутке не двигало поля.
function startDrag(event: ReactPointerEvent, controls: DragControls, onLift: (isLifted: boolean) => void) {
  if (event.pointerType === 'mouse') {
    controls.start(event);
    return;
  }

  const startX = event.clientX;
  const startY = event.clientY;
  let lastEvent: PointerEvent = event.nativeEvent;

  function cleanup() {
    clearTimeout(timer);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', cleanup);
    window.removeEventListener('pointercancel', cleanup);
  }

  function move(moveEvent: PointerEvent) {
    lastEvent = moveEvent;
    if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > PRESS_TOLERANCE) cleanup();
  }

  const timer = setTimeout(() => {
    cleanup();
    navigator.vibrate?.(15);
    onLift(true);
    controls.start(lastEvent);
  }, LONG_PRESS_MS);

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', cleanup);
  window.addEventListener('pointercancel', cleanup);
}

type RowProps = {
  point: RoutePoint;
  index: number;
  count: number;
  isLocating: boolean;
  isExpanded: boolean;
  near?: Coordinates;
  savedPlaces: SavedPlace[];
  onChange: (place: Place | null) => void;
  onMove: (shift: number) => void;
  onRemove: () => void;
  onAdd?: () => void;
  onFirstFieldInput: () => void;
};

function getLabel(index: number, count: number) {
  if (index === 0) return 'Откуда';
  return index === count - 1 ? 'Куда' : `Остановка ${index}`;
}

function getPlaceholder(index: number, count: number, isLocating: boolean) {
  if (index === 0) return isLocating ? 'Определяем местоположение…' : 'Адрес посадки';
  return index === count - 1 ? 'Куда нужно приехать' : 'Адрес остановки';
}

function PointIcon({ index, count }: { index: number; count: number }) {
  if (index === 0) return <MapPin className="size-5 shrink-0 text-success" />;
  if (index === count - 1) return <MapPin className="size-5 shrink-0 text-destructive" />;

  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-primary">
      {index}
    </span>
  );
}

function PointRow({
  point,
  index,
  count,
  isLocating,
  isExpanded,
  near,
  savedPlaces,
  onChange,
  onMove,
  onRemove,
  onAdd,
  onFirstFieldInput,
}: RowProps) {
  const controls = useDragControls();
  const [isLifted, setIsLifted] = useState(false);
  const label = getLabel(index, count);
  const { place } = point;
  const hasManyPoints = count > 2;

  return (
    <Reorder.Item
      value={point.key}
      dragListener={false}
      dragControls={controls}
      layout="position"
      // Анимация сдвига при открытии шторки сбивает прокрутку к полю.
      transition={{ layout: { duration: isExpanded ? 0 : 0.2 } }}
      data-point-key={point.key}
      onDragEnd={() => setIsLifted(false)}
      animate={{ scale: isLifted ? 1.03 : 1 }}
      className={cn(
        'flex scroll-mt-10 items-start gap-1 rounded-2xl bg-background',
        isLifted && 'relative z-10 shadow-lg',
      )}
    >
      <div className="min-w-0 flex-1" onInput={index === 0 ? onFirstFieldInput : undefined}>
        <AddressInput
          label={label}
          placeholder={getPlaceholder(index, count, isLocating)}
          icon={
            <>
              {hasManyPoints && (
                <button
                  type="button"
                  aria-label={`Переместить: ${label}`}
                  title="Перетащите, чтобы поменять порядок"
                  onPointerDown={(event) => startDrag(event, controls, setIsLifted)}
                  onPointerUp={() => setIsLifted(false)}
                  onContextMenu={(event) => event.preventDefault()}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                      event.preventDefault();
                      onMove(event.key === 'ArrowUp' ? -1 : 1);
                    }
                  }}
                  className="-my-2.5 -mr-1.5 -ml-2.5 flex w-6 shrink-0 cursor-grab touch-none items-center select-none [-webkit-touch-callout:none] justify-center self-stretch rounded-lg text-muted-foreground/60 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <GripVertical className="size-4" />
                </button>
              )}
              <PointIcon index={index} count={count} />
            </>
          }
          place={place}
          near={near}
          savedPlaces={savedPlaces}
          onAdd={onAdd}
          onChange={onChange}
        />
      </div>

      {hasManyPoints && (
        <button
          type="button"
          aria-label={`Удалить: ${label}`}
          title="Удалить"
          onClick={onRemove}
          className="-mr-1.5 flex h-[3.75rem] w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="size-5" />
        </button>
      )}
    </Reorder.Item>
  );
}

type Props = {
  points: RoutePoint[];
  isLocating: boolean;
  isExpanded: boolean;
  near?: Coordinates;
  savedPlaces: SavedPlace[];
  onChange: (points: RoutePoint[]) => void;
  onAdd: () => void;
  onFirstFieldInput: () => void;
};

export default function RoutePoints({
  points,
  isLocating,
  isExpanded,
  near,
  savedPlaces,
  onChange,
  onAdd,
  onFirstFieldInput,
}: Props) {
  function move(index: number, shift: number) {
    const target = index + shift;
    if (target < 0 || target >= points.length) return;

    const moved = [...points];
    [moved[index], moved[target]] = [moved[target], moved[index]];
    onChange(moved);
  }

  return (
    <Reorder.Group
      as="ol"
      axis="y"
      values={points.map(({ key }) => key)}
      onReorder={(keys: number[]) =>
        onChange(keys.map((key) => points.find((point) => point.key === key)!))
      }
      className="relative flex flex-col gap-2 focus-within:z-10"
    >
      {points.map((point, index) => (
        <PointRow
          key={point.key}
          point={point}
          index={index}
          count={points.length}
          isLocating={isLocating}
          isExpanded={isExpanded}
          near={near}
          savedPlaces={savedPlaces}
          onChange={(place) =>
            onChange(points.map((item) => (item === point ? { ...item, place } : item)))
          }
          onMove={(shift) => move(index, shift)}
          onRemove={() => onChange(points.filter((item) => item !== point))}
          onAdd={index === points.length - 1 && points.length < MAX_POINTS ? onAdd : undefined}
          onFirstFieldInput={onFirstFieldInput}
        />
      ))}
    </Reorder.Group>
  );
}
