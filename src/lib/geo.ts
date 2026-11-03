import brestPlaces from '@/data/brest-places.json';

export type Coordinates = { lat: number; lon: number };

export const DEFAULT_LOCATION: Coordinates = { lat: 52.0976, lon: 23.7341 };

export type Place = Coordinates & {
  id: string;
  title: string;
  subtitle: string;
  note?: string;
  house?: { street: string; number: string; city: string };
};

export type Route = {
  distanceKm: number;
  durationMin: number;
  path: [number, number][];
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    countrycode?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

type NominatimResult = {
  lat: string;
  lon: string;
  address: { road?: string; house_number?: string };
};

const SUGGESTION_LIMIT = 6;
const BELARUS_BBOX = '23.1,51.2,32.8,56.2';
const HOUSE_NUMBER = /^\d+[а-я]?(\/\d+)?$/;
const STREET_CENTER_NOTE = 'Без точного дома: точка стоит на середине улицы';
const BREST = 'Брест';
const REGION_NAME = 'Брестская область';

const Rank = { Town: 0, BrestStreet: 1, BrestPlace: 2, Poi: 2, RegionStreet: 3, Village: 4 };
const WORD_SEPARATORS = /[\s,\-«»"().]+/;

type LocalPlace = Coordinates & {
  name: string;
  rank: number;
  subtitle: string;
  city?: string;
  // Для заведений: по чему ещё искать (категория, сокращение вроде «бц»).
  extraWords?: string;
  words: string[];
};

// [название, широта, долгота, категория, адрес, город, сокращение] — см. scripts/build-pois.mjs.
type PoiRow = [string, number, number, string, string, string, string];

type RegionPlace = Coordinates & { name: string; kind: string; city?: string };

function toLocalPlace(place: Omit<LocalPlace, 'words'>): LocalPlace {
  const text = normalize(`${place.city ?? ''} ${place.name} ${place.extraWords ?? ''}`);
  return { ...place, words: text.split(WORD_SEPARATORS).filter(Boolean) };
}

// Названия городов в источнике белорусские, по-русски они не находятся.
const OTHER_CITIES = [
  { name: 'Минск', lat: 53.9023, lon: 27.5619 },
  { name: 'Гродно', lat: 53.6694, lon: 23.8131 },
  { name: 'Гомель', lat: 52.4345, lon: 30.9754 },
  { name: 'Могилёв', lat: 53.9007, lon: 30.3313 },
  { name: 'Витебск', lat: 55.1904, lon: 30.2049 },
];

const nearbyPlaces = [
  ...OTHER_CITIES.map((city) => ({ ...city, rank: Rank.Town, subtitle: 'Беларусь' })),
  ...brestPlaces.map(({ name, lat, lon, isStreet }) => ({
    name,
    lat,
    lon,
    subtitle: BREST,
    rank: isStreet ? Rank.BrestStreet : Rank.BrestPlace,
    city: isStreet ? BREST : undefined,
  })),
].map(toLocalPlace);

let localPlaces: Promise<LocalPlace[]> | undefined;

function regionToLocalPlace({ name, lat, lon, kind, city }: RegionPlace) {
  if (kind === 'street') {
    return toLocalPlace({ name, lat, lon, city, rank: Rank.RegionStreet, subtitle: REGION_NAME });
  }
  const rank = kind === 'town' ? Rank.Town : Rank.Village;
  return toLocalPlace({ name, lat, lon, rank, subtitle: REGION_NAME });
}

const curatedNames = new Set(brestPlaces.filter(({ isStreet }) => !isStreet).map(({ name }) => name));

function poiToLocalPlace([name, lat, lon, category, address, city, alias]: PoiRow) {
  const location = address ? (city === BREST ? address : `${city}, ${address}`) : city;
  return toLocalPlace({
    name,
    lat,
    lon,
    rank: Rank.Poi,
    subtitle: [category, location].filter(Boolean).join(' · '),
    extraWords: `${category} ${alias}`,
  });
}

// Справочники области и заведений большие, поэтому грузим их только при первом поиске.
function loadLocalPlaces() {
  localPlaces ??= Promise.all([import('@/data/brest-region.json'), import('@/data/pois.json')]).then(
    ([{ default: region }, { default: pois }]) => [
      ...nearbyPlaces,
      ...(pois as PoiRow[]).filter(([name]) => !curatedNames.has(name)).map(poiToLocalPlace),
      ...(region as RegionPlace[]).map(regionToLocalPlace),
    ],
  );
  return localPlaces;
}

export function normalize(text: string) {
  return text.toLowerCase().replaceAll('ё', 'е');
}

function getSquaredDistance(a: Coordinates, b: Coordinates) {
  return (a.lat - b.lat) ** 2 + ((a.lon - b.lon) * 0.61) ** 2;
}

// Nominatim на название города отдаёт и одноимённые дома в других местах.
function isNearby(a: Coordinates, b: Coordinates) {
  return Math.abs(a.lat - b.lat) < 0.1 && Math.abs(a.lon - b.lon) < 0.15;
}

function getTitle({ name, city }: LocalPlace, number?: string) {
  const address = number ? `${name}, ${number}` : name;
  return city && city !== BREST ? `${city}, ${address}` : address;
}

async function searchLocal(query: string, near: Coordinates): Promise<Place[]> {
  const places = await loadLocalPlaces();
  const tokens = normalize(query).split(WORD_SEPARATORS).filter(Boolean);
  const number = tokens.length > 1 && HOUSE_NUMBER.test(tokens.at(-1)!) ? tokens.pop() : undefined;

  return places
    .filter(
      ({ words, rank }) =>
        (!number || rank === Rank.BrestStreet || rank === Rank.RegionStreet) &&
        tokens.every((token) => words.some((word) => word.startsWith(token))),
    )
    .map((place) => ({
      place,
      // «IQ» точнее совпадает с «Бизнес-центр IQ», чем с «IQOS».
      isExact: tokens.every((token) => place.words.includes(token)),
    }))
    .sort(
      (a, b) =>
        a.place.rank - b.place.rank ||
        Number(b.isExact) - Number(a.isExact) ||
        getSquaredDistance(a.place, near) - getSquaredDistance(b.place, near),
    )
    .map(({ place }) => place)
    .slice(0, SUGGESTION_LIMIT)
    .map((place) => {
      const { name, lat, lon, city, subtitle } = place;
      return {
        id: `local:${name}:${lat}:${lon}:${number ?? ''}`,
        lat,
        lon,
        title: getTitle(place, number),
        subtitle,
        note: city ? STREET_CENTER_NOTE : undefined,
        house: number && city ? { street: name, number, city } : undefined,
      };
    });
}

function toPlace({ geometry, properties: p }: PhotonFeature): Place {
  const [lon, lat] = geometry.coordinates;
  const address = p.street && p.housenumber ? `${p.street}, ${p.housenumber}` : undefined;
  const title = address ?? p.name ?? p.street ?? p.city ?? 'Без названия';
  const details = [address ? p.name : undefined, p.city ?? p.state, p.country];

  return {
    id: `${p.osm_type}${p.osm_id}`,
    lat,
    lon,
    title,
    subtitle: [...new Set(details)].filter((part) => part && part !== title).join(', '),
  };
}

export async function searchPlaces(
  query: string,
  near: Coordinates = DEFAULT_LOCATION,
  signal: AbortSignal,
): Promise<Place[]> {
  const local = await searchLocal(query, near);
  if (local.length >= SUGGESTION_LIMIT) return local;

  const params = new URLSearchParams({
    q: query,
    limit: '20',
    lang: 'default',
    lat: String(near.lat),
    lon: String(near.lon),
    bbox: BELARUS_BBOX,
  });

  try {
    const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
    if (!response.ok) throw new Error(`Photon: ${response.status}`);

    const { features } = (await response.json()) as { features: PhotonFeature[] };
    const inBelarus = features.filter((feature) => feature.properties.countrycode === 'BY');
    return [...local, ...inBelarus.map(toPlace)].slice(0, SUGGESTION_LIMIT);
  } catch (error) {
    if (local.length > 0 && !signal.aborted) return local;
    throw error;
  }
}

export async function resolvePlace(place: Place): Promise<Place> {
  if (!place.house) return place;

  const { street, number, city } = place.house;
  const params = new URLSearchParams({
    street: `${number} ${street}`,
    city,
    countrycodes: 'by',
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'ru',
    limit: '20',
  });
  const notFound = { ...place, note: `Дом ${number} не найден: точка стоит на середине улицы` };

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    const results = (await response.json()) as NominatimResult[];
    const exact = results.find(
      ({ address, lat, lon }) =>
        address.house_number === number &&
        isNearby({ lat: Number(lat), lon: Number(lon) }, place),
    );
    if (!exact) return notFound;

    return { ...place, lat: Number(exact.lat), lon: Number(exact.lon), note: undefined };
  } catch {
    return notFound;
  }
}

export async function findPlaceAt(position: Coordinates): Promise<Place> {
  const fallback = { ...position, id: 'my-location', title: 'Моё местоположение', subtitle: '' };

  try {
    const params = new URLSearchParams({
      lat: String(position.lat),
      lon: String(position.lon),
      format: 'jsonv2',
      addressdetails: '1',
      'accept-language': 'ru',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
    const { address } = (await response.json()) as NominatimResult;
    if (!address?.road) return fallback;

    const title = address.house_number ? `${address.road}, ${address.house_number}` : address.road;
    return { ...fallback, title };
  } catch {
    return fallback;
  }
}

function getPosition(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

// Точный режим на компьютерах и в помещениях часто не срабатывает, тогда берём примерный.
export async function locateUser(): Promise<Place> {
  const { coords } = await getPosition({ enableHighAccuracy: true, timeout: 8000 }).catch(
    (error: GeolocationPositionError | Error) => {
      if ('code' in error && error.code === error.PERMISSION_DENIED) throw error;
      return getPosition({ maximumAge: 600000, timeout: 8000 });
    },
  );
  return findPlaceAt({ lat: coords.latitude, lon: coords.longitude });
}

export async function fetchRoute(points: Coordinates[], signal: AbortSignal): Promise<Route> {
  const coordinates = points.map(({ lat, lon }) => `${lon},${lat}`).join(';');
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
    { signal },
  );
  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error(`OSRM: ${data.code}`);

  const route = data.routes[0];
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    path: route.geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]),
  };
}
