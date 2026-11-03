import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { Dialog } from 'radix-ui';

import PlaceDialog from '@/components/PlaceDialog';
import SheetHandle from '@/components/SheetHandle';
import type { Place } from '@/lib/geo';
import { cn } from '@/lib/utils';
import { getPlaceIcon, replaceSavedPlace, type SavedPlace } from '@/lib/savedPlaces';
import { SHEET_CONTENT_ANIMATION, SHEET_OVERLAY_ANIMATION, useClosingSheet } from '@/lib/useClosingSheet';
import { useSwipeToClose } from '@/lib/useSwipeToClose';

type DialogState = {
  name?: string;
  place: Place | null;
};

type Props = {
  places: SavedPlace[];
  onChange: (places: SavedPlace[]) => void;
  onClose: () => void;
};

export default function PlacesSheet({ places, onChange, onClose }: Props) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const { isOpen, close, onAnimationEnd } = useClosingSheet(onClose);
  const { sheetRef, handleProps } = useSwipeToClose<HTMLDivElement>(onClose);

  function update(updated: SavedPlace[]) {
    onChange(updated);
    setDialog(null);
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn('fixed inset-0 z-40 bg-black/50', SHEET_OVERLAY_ANIMATION)} />
        <Dialog.Content
          ref={sheetRef}
          aria-describedby={undefined}
          onAnimationEnd={onAnimationEnd}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(
            'fixed inset-x-0 top-3 bottom-0 z-40 mx-auto flex max-w-xl flex-col overflow-y-auto overscroll-contain rounded-t-3xl bg-background px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg',
            SHEET_CONTENT_ANIMATION,
          )}
        >
          <div
            {...handleProps}
            className="sticky top-0 z-10 -mx-4 touch-none bg-background px-4 pt-2 pb-3"
          >
            <SheetHandle label="Закрыть" onClick={() => close()} />
            <Dialog.Title className="text-lg font-semibold">Мои адреса</Dialog.Title>
          </div>

          {places.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Сохраните дом, работу или другие частые адреса, чтобы выбирать их одним нажатием
            </p>
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
                    <Icon className="size-5 shrink-0 text-accent-foreground" />
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
            className="mt-3 flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-muted text-base font-semibold transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-5" />
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
