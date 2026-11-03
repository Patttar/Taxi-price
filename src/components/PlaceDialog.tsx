import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Dialog } from 'radix-ui';

import AddressInput from '@/components/AddressInput';
import SheetHandle from '@/components/SheetHandle';
import type { Place } from '@/lib/geo';
import { PLACE_PRESETS, type SavedPlace } from '@/lib/savedPlaces';
import { useKeyboardInset } from '@/lib/useKeyboardInset';
import { SHEET_CONTENT_ANIMATION, SHEET_OVERLAY_ANIMATION, useClosingSheet } from '@/lib/useClosingSheet';
import { useSwipeToClose } from '@/lib/useSwipeToClose';
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
  const { isOpen, close, onAnimationEnd } = useClosingSheet(onClose);
  const { sheetRef, handleProps } = useSwipeToClose<HTMLDivElement>(onClose);

  const trimmedName = name.trim();
  const isPreset = PLACE_PRESETS.some((preset) => preset.name === name);
  const willReplace =
    trimmedName !== initialName && places.some((saved) => saved.name === trimmedName);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn('fixed inset-0 z-50 bg-black/50', SHEET_OVERLAY_ANIMATION)} />
        <Dialog.Content
          ref={sheetRef}
          aria-describedby={undefined}
          style={{ bottom: keyboardInset }}
          onAnimationEnd={onAnimationEnd}
          onOpenAutoFocus={(event) => initialPlace && event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(
            'fixed inset-x-0 z-50 mx-auto flex max-h-[90dvh] max-w-xl flex-col gap-4 rounded-t-3xl bg-background px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lg',
            SHEET_CONTENT_ANIMATION,
          )}
        >
          <div {...handleProps} className="-mx-5 -mb-2 touch-none px-5 pb-2">
            <SheetHandle label="Закрыть" onClick={() => close()} />
            <Dialog.Title className="text-lg font-semibold">
              {initialName ? 'Изменить адрес' : 'Сохранить адрес'}
            </Dialog.Title>
          </div>

          <AddressInput
            label="Адрес"
            placeholder="Улица и дом"
            icon={<MapPin className="size-5 shrink-0 text-accent-foreground" />}
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
            className="rounded-2xl bg-muted px-4 py-3 text-base outline-none ring-ring/50 focus:ring-2"
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
                onClick={() => onDelete && close(onDelete)}
                className="h-11 rounded-xl px-4 text-sm font-semibold text-destructive hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                Удалить
              </button>
            )}
            <button
              type="button"
              disabled={!place || !trimmedName}
              onClick={() => place && close(() => onSave({ name: trimmedName, place }))}
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
