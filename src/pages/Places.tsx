import { useState } from 'react';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import PlaceDialog from '@/components/PlaceDialog';
import type { Place } from '@/lib/geo';
import {
  getPlaceIcon,
  loadSavedPlaces,
  replaceSavedPlace,
  storeSavedPlaces,
  type SavedPlace,
} from '@/lib/savedPlaces';

type DialogState = {
  name?: string;
  place: Place | null;
};

export default function Places() {
  const [places, setPlaces] = useState(loadSavedPlaces);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  function update(updated: SavedPlace[]) {
    setPlaces(updated);
    storeSavedPlaces(updated);
    setDialog(null);
  }

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
        <h1 className="text-lg font-semibold">Мои адреса</h1>
      </header>

      {places.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Сохранённых адресов нет</p>
      )}

      <ul className="flex flex-col gap-2">
        {places.map((saved) => {
          const Icon = getPlaceIcon(saved.name);
          return (
            <li key={saved.name}>
              <button
                type="button"
                onClick={() => setDialog(saved)}
                className="flex w-full items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{saved.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {saved.place.title}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setDialog({ place: null })}
        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-primary transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-4" />
        Добавить адрес
      </button>

      {dialog && (
        <PlaceDialog
          initialName={dialog.name}
          initialPlace={dialog.place}
          places={places}
          onSave={(saved) => update(replaceSavedPlace(places, saved, dialog.name))}
          onDelete={() => update(places.filter(({ name }) => name !== dialog.name))}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}
