import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';

import { getPlaceIcon, type SavedPlace } from '@/lib/savedPlaces';

const CHIP_CLASS =
  'flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring';

type Props = {
  places: SavedPlace[];
  onSelect: (saved: SavedPlace) => void;
  onEdit: (saved: SavedPlace) => void;
  onAdd: () => void;
};

export default function SavedPlaces({ places, onSelect, onEdit, onAdd }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm text-muted-foreground">Мои адреса</h2>
        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className="text-sm font-medium text-primary"
        >
          {isEditing ? 'Готово' : 'Изменить'}
        </button>
      </div>

      <ul className="flex flex-wrap gap-2">
        {places.map((saved) => {
          const Icon = getPlaceIcon(saved.name);
          return (
            <li key={saved.name} className="min-w-0">
              <button
                type="button"
                title={saved.place.title}
                onClick={() => (isEditing ? onEdit(saved) : onSelect(saved))}
                className={`${CHIP_CLASS} max-w-full bg-accent text-primary hover:bg-accent/70`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{saved.name}</span>
                {isEditing && <Pencil className="size-3.5 shrink-0" />}
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
