import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { LoaderCircle, Plus, X, type LucideIcon } from 'lucide-react';

import { normalize, resolvePlace, searchPlaces, type Coordinates, type Place } from '@/lib/geo';
import { getPlaceIcon, type SavedPlace } from '@/lib/savedPlaces';
import { cn } from '@/lib/utils';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY_MS = 300;

type Props = {
  label: string;
  placeholder: string;
  icon: ReactNode;
  place: Place | null;
  near?: Coordinates;
  savedPlaces?: SavedPlace[];
  onAdd?: () => void;
  onChange: (place: Place | null) => void;
};

type Option = {
  id: string;
  title: string;
  subtitle: string;
  place: Place;
  icon?: LucideIcon;
};

function findSaved(savedPlaces: SavedPlace[], query: string): Option[] {
  const words = normalize(query).split(/[\s,]+/).filter(Boolean);
  if (words.length === 0) return [];

  return savedPlaces
    .filter(({ name, place }) => {
      const text = normalize(`${name} ${place.title}`);
      return words.every((word) => text.includes(word));
    })
    .map(({ name, place }) => ({
      id: `saved:${name}`,
      title: name,
      subtitle: place.title,
      place,
      icon: getPlaceIcon(name),
    }));
}

type FieldButtonProps = {
  label: string;
  onClick: () => void;
  children: ReactNode;
};

function FieldButton({ label, onClick, children }: FieldButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

export default function AddressInput({
  label,
  placeholder,
  icon,
  place,
  near,
  savedPlaces = [],
  onAdd,
  onChange,
}: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isResolving, setIsResolving] = useState(false);
  const selectionRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const value = place?.title ?? text;
  const query = text.trim();
  const shouldSearch = !place && !isResolving && query.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!shouldSearch) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const places = await searchPlaces(query, near, controller.signal);
        setSuggestions(places);
        setSearchedQuery(query);
        setHasFailed(false);
        setActiveIndex(-1);
        setIsLoading(false);
      } catch {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setHasFailed(true);
        setIsLoading(false);
      }
    }, SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, near, shouldSearch]);

  function clear() {
    selectionRef.current += 1;
    setIsResolving(false);
    setText('');
    setSuggestions([]);
    setHasFailed(false);
    if (place) onChange(null);
    inputRef.current?.focus();
  }

  async function select({ place: selected, icon }: Option) {
    const request = ++selectionRef.current;
    setText(selected.title);
    setSuggestions([]);
    setIsOpen(false);
    if (icon) {
      onChange(selected);
      return;
    }

    setIsResolving(true);
    const resolved = await resolvePlace(selected);
    if (request !== selectionRef.current) return;
    setIsResolving(false);
    onChange(resolved);
  }

  const saved = place || isResolving ? [] : findSaved(savedPlaces, query);
  const found = suggestions
    .filter(({ title }) => !saved.some((option) => option.subtitle === title))
    .map((suggestion) => ({
      id: suggestion.id,
      title: suggestion.title,
      subtitle: suggestion.subtitle,
      place: suggestion,
    }));
  const options: Option[] = [...saved, ...found];

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (!isOpen || options.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? options.length - 1 : index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(options[Math.max(activeIndex, 0)]);
    }
  }

  const visible = isOpen && (shouldSearch || saved.length > 0);
  const isEmpty = shouldSearch && searchedQuery === query && !hasFailed && options.length === 0;

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="flex items-center gap-2.5 rounded-2xl bg-muted px-4 py-2.5 ring-primary/40 transition-shadow focus-within:ring-2"
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">{label}</span>
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={visible}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            value={value}
            placeholder={placeholder}
            className="w-full truncate bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
            onChange={(event) => {
              selectionRef.current += 1;
              setIsResolving(false);
              setText(event.target.value);
              setIsOpen(true);
              setSuggestions([]);
              setHasFailed(false);
              if (place) onChange(null);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onKeyDown={handleKeyDown}
          />
        </span>
        {((visible && isLoading) || isResolving) && (
          <LoaderCircle className="size-4 shrink-0 animate-spin text-muted-foreground" />
        )}
        <span className="-mr-2 flex shrink-0 empty:hidden">
          {place && onAdd && (
            <FieldButton label="Добавить остановку" onClick={onAdd}>
              <Plus className="size-5" />
            </FieldButton>
          )}
          {value && (
            <FieldButton label={`Очистить поле «${label}»`} onClick={clear}>
              <X className="size-5" />
            </FieldButton>
          )}
        </span>
      </label>

      {place?.note && <p className="mt-1 px-4 text-xs text-muted-foreground">{place.note}</p>}

      {visible && (options.length > 0 || hasFailed || isEmpty) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border bg-popover py-1 shadow-lg"
        >
          {options.map((option, index) => (
            <li
              key={option.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                'flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted',
                index === activeIndex && 'bg-muted',
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(option)}
            >
              {option.icon && <option.icon className="size-5 shrink-0 text-primary" />}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{option.title}</div>
                {option.subtitle && (
                  <div className="truncate text-xs text-muted-foreground">{option.subtitle}</div>
                )}
              </div>
            </li>
          ))}
          {hasFailed && (
            <li className="px-3 py-2 text-sm text-destructive">
              Не удалось загрузить подсказки. Попробуйте ещё раз.
            </li>
          )}
          {isEmpty && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Ничего не нашлось</li>
          )}
        </ul>
      )}
    </div>
  );
}
