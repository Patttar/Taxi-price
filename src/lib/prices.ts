import type { Coordinates, Place, Route } from './geo';

type Tariff = {
  minimum: number;
  includedKm: number;
  includedMin: number;
  perKm: number;
  perMin: number;
  outOfTownPerKm: number;
};

type Service = {
  name: string;
  tariffName: string;
  tariff: Tariff;
  // Тариф не опубликован, цена условная.
  isEstimate?: boolean;
  phone?: { href: string; label: string };
  getLink?: (from: Place, to: Place) => { href: string; label: string };
};

export type Offer = Pick<Service, 'name' | 'tariffName' | 'phone' | 'isEstimate'> & {
  link?: { href: string; label: string };
  price: number;
};

const YANDEX_PHONE = { href: 'tel:7220', label: 'Позвонить' };

function getYandexLink(from: Place, to: Place) {
  const params = new URLSearchParams({
    'start-lat': String(from.lat),
    'start-lon': String(from.lon),
    'end-lat': String(to.lat),
    'end-lon': String(to.lon),
    tariffClass: 'econom',
    ref: 'taxi-compare',
    appmetrica_tracking_id: '1178268795219780156',
  });
  return {
    href: `https://3.redirect.appmetrica.yandex.com/route?${params}`,
    label: 'В приложении',
  };
}

function yandexGo(tariff: Tariff): Service {
  return { name: 'Яндекс Go', tariffName: 'Эконом', tariff, phone: YANDEX_PHONE, getLink: getYandexLink };
}

export type City = Coordinates & {
  name: string;
  // В каком падеже писать «Цены для …».
  nameFor: string;
  radiusKm: number;
  // Пробег, после которого считаем загородный тариф.
  cityKm: number;
  services: Service[];
};

// Тарифы Яндекс Go — опубликованный максимум без «горячих часов»: taxi.yandex.ru/<город>/tariff.
// Срок на страницах регулярно сдвигается, проверено 2026-11-03.
export const CITIES: City[] = [
  {
    name: 'Брест',
    nameFor: 'Бреста',
    lat: 52.0976,
    lon: 23.7341,
    radiusKm: 12,
    cityKm: 15,
    services: [
      yandexGo({ minimum: 2.8, includedKm: 1.5, includedMin: 3, perKm: 0.5, perMin: 0.25, outOfTownPerKm: 1.2 }),
      {
        name: 'WB Taxi',
        tariffName: 'Стандарт',
        isEstimate: true,
        // Тариф не опубликован: примерно на 25% ниже Яндекса по замерам цен в Минске.
        tariff: { minimum: 2.1, includedKm: 1.5, includedMin: 3, perKm: 0.38, perMin: 0.19, outOfTownPerKm: 0.9 },
        getLink() {
          const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent);
          return {
            href: isApple
              ? 'https://apps.apple.com/by/app/id6755240054'
              : 'https://play.google.com/store/apps/details?id=com.wb.taxi.client',
            label: 'Приложение',
          };
        },
      },
      {
        name: 'Такси Сити',
        tariffName: 'Стандарт',
        isEstimate: true,
        // Опубликован только загородный тариф 0,69 Br/км, городские значения условные.
        tariff: { minimum: 2.5, includedKm: 1.5, includedMin: 3, perKm: 0.5, perMin: 0.2, outOfTownPerKm: 0.69 },
        phone: { href: 'tel:+375295656666', label: 'Позвонить' },
      },
    ],
  },
  {
    // Местные службы Пинска найдены только в каталогах 2018–2022 годов, поэтому их нет.
    name: 'Пинск',
    nameFor: 'Пинска',
    lat: 52.1153,
    lon: 26.1031,
    radiusKm: 10,
    cityKm: 9,
    services: [
      yandexGo({ minimum: 2.6, includedKm: 1, includedMin: 2, perKm: 0.6, perMin: 0.2, outOfTownPerKm: 1.3 }),
    ],
  },
  {
    name: 'Кобрин',
    nameFor: 'Кобрина',
    lat: 52.2139,
    lon: 24.3564,
    radiusKm: 7,
    cityKm: 6,
    services: [
      yandexGo({ minimum: 2.5, includedKm: 1.2, includedMin: 2, perKm: 0.6, perMin: 0.12, outOfTownPerKm: 1.3 }),
    ],
  },
];

function distanceKm(a: Coordinates, b: Coordinates) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Город определяем по точке посадки: такси берут там, откуда едут.
export function findCity(from: Coordinates) {
  return CITIES.find((city) => distanceKm(city, from) <= city.radiusKm) ?? null;
}

function getPrice({ distanceKm: km, durationMin }: Route, tariff: Tariff, city: City) {
  const cityKm = Math.min(km, city.cityKm);
  const outOfTownKm = Math.max(km - city.cityKm, 0);
  const fare =
    tariff.minimum +
    Math.max(cityKm - tariff.includedKm, 0) * tariff.perKm +
    outOfTownKm * tariff.outOfTownPerKm +
    Math.max(durationMin - tariff.includedMin, 0) * tariff.perMin;

  return Math.round(fare * 100) / 100;
}

export function getOffers(city: City, route: Route, from: Place, to: Place): Offer[] {
  return city.services
    .map(({ name, tariffName, tariff, isEstimate, phone, getLink }) => ({
      name,
      tariffName,
      isEstimate,
      phone,
      link: getLink?.(from, to),
      price: getPrice(route, tariff, city),
    }))
    .sort((a, b) => a.price - b.price);
}
