// Обновляет справочник Брестской области: node scripts/build-region-places.mjs
// Улицы берём только у городов и посёлков: улицы деревень раздули бы файл в разы.
import { writeFile } from 'node:fs/promises';

const OUTPUT = new URL('../src/data/brest-region.json', import.meta.url);
const STREET_RADIUS_M = 7000;
const REGION = 'area["ISO3166-2"="BY-BR"]->.region';
const STREETS = 'primary|secondary|tertiary|residential|unclassified|living_street|pedestrian';

async function overpass(query) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'taxi-compare-data-build' },
      body: new URLSearchParams({ data: query }),
    });
    if (response.ok) return (await response.json()).elements;
    if (attempt === 5) throw new Error(`Overpass: ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 15000));
  }
}

const round = (value) => Number(value.toFixed(5));
const getName = (tags) => tags['name:ru'] ?? tags.name;
const squaredDistance = (a, b) => (a.lat - b.lat) ** 2 + ((a.lon - b.lon) * 0.61) ** 2;

const settlements = await overpass(`[out:json][timeout:120];${REGION};
node(area.region)[place~"^(city|town|village|hamlet)$"][name];
out body;`);

const towns = settlements
  .filter(({ tags }) => tags.place === 'city' || tags.place === 'town')
  .map(({ tags, lat, lon }) => ({ name: getName(tags), lat, lon }));

const streets = await overpass(`[out:json][timeout:170];${REGION};
node(area.region)[place~"^(city|town)$"]->.towns;
way(around.towns:${STREET_RADIUS_M})[highway~"^(${STREETS})$"][name];
out tags center;`);

const places = new Map();

for (const { tags, lat, lon } of settlements) {
  const name = getName(tags);
  places.set(`${name}:${round(lat)}`, {
    name,
    lat: round(lat),
    lon: round(lon),
    kind: tags.place === 'city' || tags.place === 'town' ? 'town' : 'village',
  });
}

for (const { tags, center } of streets) {
  const town = towns.reduce((nearest, item) =>
    squaredDistance(item, center) < squaredDistance(nearest, center) ? item : nearest,
  );
  const degrees = STREET_RADIUS_M / 111000;
  if (town.name === 'Брест' || squaredDistance(town, center) > degrees ** 2) continue;

  const name = getName(tags);
  const key = `${town.name}:${name}`;
  if (!places.has(key)) {
    places.set(key, { name, lat: round(center.lat), lon: round(center.lon), kind: 'street', city: town.name });
  }
}

const sorted = [...places.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
await writeFile(OUTPUT, `${JSON.stringify(sorted)}\n`);

const count = (kind) => sorted.filter((place) => place.kind === kind).length;
const belarusian = sorted.filter(({ name }) => /[іўІЎ]/.test(name)).length;
console.log(`towns: ${count('town')}, villages: ${count('village')}, streets: ${count('street')}, belarusian names: ${belarusian}`);
console.log(towns.map(({ name }) => name).sort().join(', '));
