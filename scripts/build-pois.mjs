// Обновляет справочник заведений с адресами: node scripts/build-pois.mjs
// Источник — OpenStreetMap через Overpass. Если у заведения нет своего адреса,
// берём адрес ближайшего дома: так находится, например, «Бизнес-центр IQ».
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUTPUT = new URL('../src/data/pois.json', import.meta.url);
const ENDPOINTS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter'];
const NEAREST_ADDRESS_M = 80;
const DUPLICATE_M = 150;

const CITIES = [
  { name: 'Брест', bbox: '52.03,23.55,52.17,23.85' },
  { name: 'Пинск', bbox: '52.07,26.00,52.16,26.20' },
  { name: 'Кобрин', bbox: '52.18,24.30,52.25,24.42' },
  { name: 'Барановичи', bbox: '53.08,25.92,53.17,26.10' },
];

const SKIP_AMENITY =
  /^(parking|parking_space|parking_entrance|bench|waste_basket|waste_disposal|vending_machine|recycling|toilets|shelter|bicycle_parking|atm|post_box|telephone|charging_station|drinking_water|grave_yard|hunting_stand|clock|fountain|bbq|loading_dock|motorcycle_parking|compressed_air|water_point)$/;
const SKIP_BUILDING = /^(house|residential|apartments|detached|garage|garages|shed|roof|hut|cabin|barn|construction|ruins)$/;

const CATEGORIES = {
  amenity: {
    cafe: 'Кафе', restaurant: 'Ресторан', fast_food: 'Фастфуд', bar: 'Бар', pub: 'Паб',
    pharmacy: 'Аптека', bank: 'Банк', school: 'Школа', kindergarten: 'Детский сад',
    university: 'Университет', college: 'Колледж', hospital: 'Больница', clinic: 'Поликлиника',
    doctors: 'Медцентр', dentist: 'Стоматология', fuel: 'АЗС', place_of_worship: 'Храм',
    theatre: 'Театр', cinema: 'Кинотеатр', library: 'Библиотека', post_office: 'Почта',
    police: 'Милиция', marketplace: 'Рынок', bus_station: 'Автовокзал', car_wash: 'Автомойка',
    nightclub: 'Клуб', townhall: 'Администрация', courthouse: 'Суд', community_centre: 'Дом культуры',
    arts_centre: 'Культурный центр', veterinary: 'Ветклиника', driving_school: 'Автошкола',
    language_school: 'Школа', music_school: 'Музыкальная школа', sauna: 'Сауна',
    car_rental: 'Прокат авто', ice_cream: 'Мороженое', events_venue: 'Банкетный зал',
  },
  shop: {
    supermarket: 'Супермаркет', convenience: 'Магазин', mall: 'Торговый центр',
    department_store: 'Универмаг', clothes: 'Одежда', shoes: 'Обувь', electronics: 'Электроника',
    mobile_phone: 'Связь', hardware: 'Стройматериалы', doityourself: 'Стройматериалы',
    furniture: 'Мебель', florist: 'Цветы', bakery: 'Пекарня', car_repair: 'Автосервис',
    car: 'Автосалон', car_parts: 'Автозапчасти', beauty: 'Салон красоты', hairdresser: 'Парикмахерская',
    cosmetics: 'Косметика', optician: 'Оптика', books: 'Книги', toys: 'Игрушки', pet: 'Зоотовары',
    alcohol: 'Алкоголь', butcher: 'Мясо', jewelry: 'Ювелирный', sports: 'Спорттовары',
    chemist: 'Бытовая химия', kiosk: 'Киоск', gift: 'Подарки', computer: 'Компьютеры',
  },
  tourism: {
    hotel: 'Гостиница', hostel: 'Хостел', museum: 'Музей', attraction: 'Достопримечательность',
    guest_house: 'Гостевой дом', motel: 'Мотель', gallery: 'Галерея', zoo: 'Зоопарк',
  },
  leisure: {
    park: 'Парк', fitness_centre: 'Фитнес', sports_centre: 'Спорткомплекс', stadium: 'Стадион',
    swimming_pool: 'Бассейн', water_park: 'Аквапарк', playground: 'Детская площадка',
    garden: 'Сквер', ice_rink: 'Ледовая арена', bowling_alley: 'Боулинг',
  },
  healthcare: { centre: 'Медцентр', laboratory: 'Лаборатория', dentist: 'Стоматология' },
  railway: { station: 'Вокзал' },
  aeroway: { aerodrome: 'Аэропорт' },
};

// Сокращения, которыми ищут: «бц iq», «тц корона».
const ALIASES = [
  [/бизнес-центр|бизнес центр/i, 'бц'],
  [/торгово-развлекательный центр/i, 'трц'],
  [/торговый центр|торговый дом/i, 'тц'],
];

function getCategory(tags) {
  for (const [key, values] of Object.entries(CATEGORIES)) {
    if (values[tags[key]]) return values[tags[key]];
  }
  if (tags.office) return 'Офис';
  if (tags.shop) return 'Магазин';
  if (tags.building === 'commercial' || tags['building:part'] === 'commercial') return 'Здание';
  return '';
}

// Серверы Overpass часто перегружены: ответы храним во временной папке, чтобы повторный запуск не качал заново.
const CACHE_DIR = join(tmpdir(), 'taxi-overpass-cache');

async function overpass(query) {
  await mkdir(CACHE_DIR, { recursive: true });
  const cacheFile = join(CACHE_DIR, `${createHash('sha1').update(query).digest('hex')}.json`);
  const cached = await readFile(cacheFile, 'utf8').catch(() => undefined);
  if (cached) return JSON.parse(cached);

  const elements = await download(query);
  await writeFile(cacheFile, JSON.stringify(elements));
  return elements;
}

async function download(query) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'taxi-compare-data-build' },
      body: new URLSearchParams({ data: query }),
    }).catch((error) => ({ ok: false, status: error.message }));
    if (response.ok) return (await response.json()).elements;
    console.warn(`  ${endpoint}: ${response.status}, повтор`);
    await new Promise((resolve) => setTimeout(resolve, Math.min(5000 * 2 ** attempt, 60_000)));
  }
  throw new Error('Overpass не ответил');
}

function metres(a, b) {
  const dLat = (a.lat - b.lat) * 111_320;
  const dLon = (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

// Сетка ~100 м, чтобы не перебирать все дома для каждого заведения.
function buildGrid(points) {
  const grid = new Map();
  for (const point of points) {
    const key = `${Math.floor(point.lat * 1000)}:${Math.floor(point.lon * 700)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(point);
  }
  return (position) => {
    let best;
    const lat = Math.floor(position.lat * 1000);
    const lon = Math.floor(position.lon * 700);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (const point of grid.get(`${lat + dy}:${lon + dx}`) ?? []) {
          const distance = metres(point, position);
          if (distance <= NEAREST_ADDRESS_M && (!best || distance < best.distance)) best = { ...point, distance };
        }
      }
    }
    return best;
  };
}

function shortStreet(street) {
  return street.replace(/^улица /, 'ул. ').replace(/ улица$/, ' ул.').replace(/проспект/, 'просп.');
}

const result = [];

for (const city of CITIES) {
  console.log(`${city.name}…`);
  const pois = await overpass(`[out:json][timeout:180][bbox:${city.bbox}];
(
  nwr[name][amenity];
  nwr[name][shop];
  nwr[name][office];
  nwr[name][tourism];
  nwr[name][leisure];
  nwr[name][healthcare];
  nwr[name][railway=station];
  nwr[name][aeroway=aerodrome];
  nwr[name][building];
  nwr[name]["building:part"];
);
out tags center;`);
  const addresses = await overpass(`[out:json][timeout:180][bbox:${city.bbox}];
nwr["addr:street"]["addr:housenumber"];
out tags center;`);

  // В адресах OSM Беларуси улицы записаны по-белорусски, русское название берём у самой улицы.
  const streets = await overpass(`[out:json][timeout:180][bbox:${city.bbox}];
way[highway][name]["name:ru"];
out tags;`);
  const russianStreet = new Map(streets.map(({ tags }) => [tags.name, tags['name:ru']]));
  const toRussian = (street) => russianStreet.get(street) ?? street;

  const findAddress = buildGrid(
    addresses
      .map(({ tags, center, lat, lon }) => ({ ...(center ?? { lat, lon }), street: tags['addr:street:ru'] ?? toRussian(tags['addr:street']), number: tags['addr:housenumber'] }))
      .filter(({ lat }) => lat !== undefined),
  );

  const kept = [];
  for (const { tags, center, lat, lon } of pois) {
    const position = center ?? { lat, lon };
    const name = (tags['name:ru'] ?? tags.name)?.trim();
    if (!name || position.lat === undefined) continue;
    if (SKIP_AMENITY.test(tags.amenity ?? '')) continue;
    const isOnlyBuilding = !tags.amenity && !tags.shop && !tags.office && !tags.tourism && !tags.leisure && !tags.healthcare;
    if (isOnlyBuilding && SKIP_BUILDING.test(tags.building ?? tags['building:part'] ?? '')) continue;
    // Название, совпадающее с адресом, ничего не добавляет к поиску улиц.
    if (/^\d|улица|переулок|проспект/i.test(name) && isOnlyBuilding) continue;

    const own = tags['addr:street'] && tags['addr:housenumber'] ? { street: tags['addr:street:ru'] ?? toRussian(tags['addr:street']), number: tags['addr:housenumber'] } : undefined;
    const address = own ?? findAddress(position);
    const category = getCategory(tags);
    const duplicate = kept.find((item) => item.name === name && metres(item, position) < DUPLICATE_M);
    if (duplicate) {
      if (!duplicate.address && address) duplicate.address = address;
      if (!duplicate.category && category) duplicate.category = category;
      continue;
    }
    kept.push({ name, lat: position.lat, lon: position.lon, category, address });
  }

  for (const { name, lat, lon, category, address } of kept) {
    const alias = ALIASES.find(([pattern]) => pattern.test(`${category} ${name}`))?.[1] ?? '';
    result.push([
      name,
      Number(lat.toFixed(5)),
      Number(lon.toFixed(5)),
      category,
      address ? `${shortStreet(address.street)}, ${address.number}` : '',
      city.name,
      alias,
    ]);
  }
  console.log(`  заведений: ${kept.length}, с адресом: ${kept.filter((item) => item.address).length}`);
}

await writeFile(OUTPUT, `${JSON.stringify(result)}\n`);
console.log(`всего: ${result.length}`);
