import { ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { getPlaceIcon, type SavedPlace } from '@/lib/savedPlaces';

const CHIP_CLASS =
  'flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring';

type Props = {
  places: SavedPlace[];
  onSelect: (saved: SavedPlace) => void;
  onAdd: () => void;
};

export default function SavedPlaces({ places, onSelect, onAdd }: Props) {
  return (
    <section className="flex flex-col gap-2">
      <Link
        to="/places"
        aria-label="Все адреса"
        className="flex items-center justify-between gap-3 rounded-lg pr-4 text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <h2 className="text-sm">Мои адреса</h2>
        <ChevronRight className="size-5 shrink-0" />
      </Link>

      <ul className="flex flex-wrap gap-2">
        {places.map((saved) => {
          const Icon = getPlaceIcon(saved.name);
          return (
            <li key={saved.name} className="min-w-0">
              <button
                type="button"
                title={saved.place.title}
                onClick={() => onSelect(saved)}
                className={`${CHIP_CLASS} max-w-full bg-accent text-primary hover:bg-accent/70`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{saved.name}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onAdd}
            className={`${CHIP_CLASS} border text-muted-foreground hover:bg-muted`}
          >
            <Plus className="size-4" />
            Добавить
          </button>
        </li>
      </ul>
    </section>
  );
}
