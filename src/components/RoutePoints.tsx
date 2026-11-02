import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, MapPin, Trash2 } from 'lucide-react';

import AddressInput from '@/components/AddressInput';
import type { Coordinates, Place } from '@/lib/geo';
import type { SavedPlace } from '@/lib/savedPlaces';

export type RoutePoint = { key: number; place: Place | null };

const MAX_POINTS = 5;

type RowProps = {
  point: RoutePoint;
  index: number;
  count: number;
  isLocating: boolean;
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
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
      {index}
    </span>
  );
}

function PointRow({
  point,
  index,
  count,
  isLocating,
  near,
  savedPlaces,
  onChange,
  onMove,
  onRemove,
  onAdd,
  onFirstFieldInput,
}: RowProps) {
  const controls = useDragControls();
  const label = getLabel(index, count);
  const { place } = point;
  const hasManyPoints = count > 2;

  return (
    <Reorder.Item
      value={point.key}
      dragListener={false}
      dragControls={controls}
      layout="position"
      className="flex items-start gap-1 bg-background"
    >
      <div className="min-w-0 flex-1">
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
                  onPointerDown={(event) => controls.start(event)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                      event.preventDefault();
                      onMove(event.key === 'ArrowUp' ? -1 : 1);
                    }
                  }}
                  className="-my-2.5 -mr-1.5 -ml-2.5 flex w-6 shrink-0 cursor-grab touch-none items-center justify-center self-stretch rounded-lg text-muted-foreground/60 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <GripVertical className="size-4" />
                </button>
              )}
              <PointIcon index={index} count={count} />
            </>
          }
          place={place}
          near={near}
          isSaved={savedPlaces.some((saved) => saved.place.title === place?.title)}
          onSave={place ? () => onSave(place) : undefined}
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
  near?: Coordinates;
  savedPlaces: SavedPlace[];
  onChange: (points: RoutePoint[]) => void;
  onAdd: () => void;
  onSave: (place: Place) => void;
};

export default function RoutePoints({
  points,
  isLocating,
  near,
  savedPlaces,
  onChange,
  onAdd,
  onSave,
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
      className="relative z-10 flex flex-col gap-2"
    >
      {points.map((point, index) => (
        <PointRow
          key={point.key}
          point={point}
          index={index}
          count={points.length}
          isLocating={isLocating}
          near={near}
          savedPlaces={savedPlaces}
          onChange={(place) =>
            onChange(points.map((item) => (item === point ? { ...item, place } : item)))
          }
          onMove={(shift) => move(index, shift)}
          onRemove={() => onChange(points.filter((item) => item !== point))}
          onSave={onSave}
          onAdd={index === points.length - 1 && points.length < MAX_POINTS ? onAdd : undefined}
        />
      ))}
    </Reorder.Group>
  );
}
