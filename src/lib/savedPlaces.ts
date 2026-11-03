import {
  Baby,
  Briefcase,
  Building2,
  Dumbbell,
  House,
  School,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type { Place } from './geo';

export type SavedPlace = { name: string; place: Place };

export const PLACE_PRESETS: { name: string; icon: LucideIcon }[] = [
  { name: 'Дом', icon: House },
  { name: 'Работа', icon: Briefcase },
  { name: 'Офис', icon: Building2 },
  { name: 'Школа', icon: School },
  { name: 'Детский сад', icon: Baby },
  { name: 'Спортзал', icon: Dumbbell },
  { name: 'Родители', icon: Users },
];

const STORAGE_KEY = 'taxi.saved-places';

export function getPlaceIcon(name: string) {
  return PLACE_PRESETS.find((preset) => preset.name === name)?.icon ?? Star;
}

export function loadSavedPlaces(): SavedPlace[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function replaceSavedPlace(
  places: SavedPlace[],
  saved: SavedPlace,
  previousName?: string,
): SavedPlace[] {
  const others = places.filter(({ name }) => name !== saved.name && name !== previousName);
  return [...others, saved];
}

export function storeSavedPlaces(places: SavedPlace[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  } catch {
    // Без хранилища адреса просто живут до перезагрузки страницы.
  }
}
