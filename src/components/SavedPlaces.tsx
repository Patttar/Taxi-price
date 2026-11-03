import { ChevronRight, Plus } from 'lucide-react';

import { getPlaceIcon, type SavedPlace } from '@/lib/savedPlaces';

const CHIP_CLASS =
  'flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring';

type Props = {
  places: SavedPlace[];
  onSelect: (saved: SavedPlace) => void;
  onAdd: () => void;
  onOpenAll: () => void;
};

export default function SavedPlaces({ places, onSelect, onAdd, onOpenAll }: Props) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-muted pt-2 pb-4">
      {places.length > 0 ? (
        <button
          type="button"
          aria-label="Все адреса"
          onClick={onOpenAll}
          className="flex items-center justify-between gap-3 rounded-lg px-4 py-1.5 text-left focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Мои адреса</h2>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <h2 className="px-4 py-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Мои адреса
        </h2>
      )}

      <ul className="flex flex-wrap gap-2 px-4">
        {places.map((saved) => {
          const Icon = getPlaceIcon(saved.name);
          return (
            <li key={saved.name} className="min-w-0">
              <button
                type="button"
                title={saved.place.title}
                onClick={() => onSelect(saved)}
                className={`${CHIP_CLASS} max-w-full bg-card shadow-xs hover:bg-accent`}
              >
                <Icon className="size-4 shrink-0 text-accent-foreground" />
                <span className="truncate">{saved.name}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onAdd}
            className={`${CHIP_CLASS} bg-card text-muted-foreground shadow-xs hover:bg-accent hover:text-foreground`}
          >
            <Plus className="size-4" />
            Добавить адрес
          </button>
        </li>
      </ul>
    </section>
  );
}
