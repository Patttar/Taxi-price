import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Dialog } from 'radix-ui';

import AddressInput from '@/components/AddressInput';
import type { Place } from '@/lib/geo';
import { PLACE_PRESETS, type SavedPlace } from '@/lib/savedPlaces';
import { useKeyboardInset } from '@/lib/useKeyboardInset';
import { cn } from '@/lib/utils';

const MAX_NAME_LENGTH = 24;

type Props = {
  initialName?: string;
  initialPlace: Place | null;
  places: SavedPlace[];
  onSave: (saved: SavedPlace) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export default function PlaceDialog({
  initialName = '',
  initialPlace,
  places,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [place, setPlace] = useState(initialPlace);
  const [name, setName] = useState(initialName);
  const keyboardInset = useKeyboardInset();

  const trimmedName = name.trim();
  const isPreset = PLACE_PRESETS.some((preset) => preset.name === name);
  const willReplace =
    trimmedName !== initialName && places.some((saved) => saved.name === trimmedName);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 animate-in fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ bottom: keyboardInset }}
          onOpenAutoFocus={(event) => initialPlace && event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="fixed inset-x-0 z-50 mx-auto flex max-h-[90dvh] max-w-xl flex-col gap-4 rounded-t-3xl bg-background px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lg animate-in slide-in-from-bottom duration-200"
        >
          <div aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border" />
          <Dialog.Title className="text-lg font-semibold">
            {initialName ? 'Изменить адрес' : 'Сохранить адрес'}
          </Dialog.Title>

          <AddressInput
            label="Адрес"
            placeholder="Улица и дом"
            icon={<MapPin className="size-5 shrink-0 text-primary" />}
            place={place}
            onChange={setPlace}
          />

          <div className="flex flex-wrap gap-2">
            {PLACE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                aria-pressed={preset.name === name}
                onClick={() => setName(preset.name)}
                className={cn(
                  'flex h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  preset.name === name && 'bg-primary text-primary-foreground',
                )}
              >
                <preset.icon className="size-4" />
                {preset.name}
              </button>
            ))}
          </div>

          <input
            value={isPreset ? '' : name}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Или своё название"
            aria-label="Своё название"
            onChange={(event) => setName(event.target.value)}
            className="rounded-2xl bg-muted px-4 py-3 text-base outline-none ring-primary/40 focus:ring-2"
          />

          {willReplace && (
            <p className="text-sm text-muted-foreground">
              «{trimmedName}» уже сохранён: адрес будет заменён.
            </p>
          )}

          <div className="flex gap-2">
            {initialName && (
              <button
                type="button"
                onClick={onDelete}
                className="h-11 rounded-xl px-4 text-sm font-semibold text-destructive hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                Удалить
              </button>
            )}
            <button
              type="button"
              disabled={!place || !trimmedName}
              onClick={() => place && onSave({ name: trimmedName, place })}
              className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
