// Обновляет справочник улиц и мест Бреста: node scripts/build-brest-places.mjs
import { writeFile } from 'node:fs/promises';

const BBOX = '52.03,23.55,52.17,23.85';
const OUTPUT = new URL('../src/data/brest-places.json', import.meta.url);
const FRIENDLY_NAMES = { 'Брест-Центральный': 'Железнодорожный вокзал Брест-Центральный' };

const query = `[out:json][timeout:90][bbox:${BBOX}];
(
  way[highway~"^(primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"][name];
  nwr[railway=station][name];
  nwr[amenity~"^(bus_station|hospital|clinic|university|college|theatre|cinema|marketplace)$"][name];
  nwr[shop=mall][name];
  nwr[tourism~"^(hotel|museum|attraction)$"][name];
  nwr[aeroway=aerodrome][name];
);
out tags center;`;

const response = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'taxi-compare-data-build' },
  body: new URLSearchParams({ data: query }),
});
if (!response.ok) throw new Error(`Overpass: ${response.status}`);

const { elements } = await response.json();
const places = new Map();

for (const { tags, center, lat, lon } of elements) {
  const sourceName = tags['name:ru'] ?? tags.name;
  const name = FRIENDLY_NAMES[sourceName] ?? sourceName;
  const position = center ?? { lat, lon };
  if (!name || position.lat === undefined) continue;

  const isStreet = Boolean(tags.highway);
  const key = `${isStreet}:${name}`;
  if (!places.has(key)) {
    places.set(key, {
      name,
      lat: Number(position.lat.toFixed(5)),
      lon: Number(position.lon.toFixed(5)),
      isStreet,
    });
  }
}

const sorted = [...places.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
await writeFile(OUTPUT, `${JSON.stringify(sorted)}\n`);
console.log(`streets: ${sorted.filter((p) => p.isStreet).length}, places: ${sorted.filter((p) => !p.isStreet).length}`);
