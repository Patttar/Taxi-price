import type { Place, Route } from './geo';

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
  phone?: { href: string; label: string };
  getLink: (from: Place, to: Place) => { href: string; label: string };
};

export type Offer = Pick<Service, 'name' | 'tariffName' | 'phone'> & {
  link: { href: string; label: string };
  price: number;
};

// Брест целиком укладывается в этот пробег, дальше считаем загородный тариф.
const CITY_KM = 15;

const SERVICES: Service[] = [
  {
    name: 'Яндекс Go',
    tariffName: 'Эконом',
    // Опубликованный максимум для Бреста: taxi.yandex.ru/brest/tariff, без «горячих часов».
    tariff: { minimum: 2.8, includedKm: 1.5, includedMin: 3, perKm: 0.5, perMin: 0.25, outOfTownPerKm: 1.2 },
    phone: { href: 'tel:+375297222222', label: 'Позвонить' },
    getLink(from, to) {
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
    },
  },
  {
    name: 'WB Taxi',
    tariffName: 'Стандарт',
    // Тариф не опубликован: примерно на 25% ниже Яндекса по замерам цен в Минске.
    tariff: { minimum: 2.1, includedKm: 1.5, includedMin: 3, perKm: 0.38, perMin: 0.19, outOfTownPerKm: 0.9 },
    getLink() {
      const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent);
      return {
        href: isApple
          ? 'https://apps.apple.com/app/id6755240054'
          : 'https://play.google.com/store/apps/details?id=com.wb.taxi.client',
        label: 'Приложение',
      };
    },
  },
  {
    name: 'Такси Сити',
    tariffName: 'Стандарт',
    // Опубликован только загородный тариф 0,69 Br/км, городские значения условные.
    tariff: { minimum: 2.5, includedKm: 1.5, includedMin: 3, perKm: 0.5, perMin: 0.2, outOfTownPerKm: 0.69 },
    phone: { href: 'tel:+375295656666', label: 'Позвонить' },
    getLink: () => ({ href: 'https://citytaxi.by/', label: 'На сайт' }),
  },
  {
    name: 'Максим',
    tariffName: 'Эконом',
    // Опубликованного тарифа нет, значения условные.
    tariff: { minimum: 2.6, includedKm: 1.5, includedMin: 3, perKm: 0.55, perMin: 0.2, outOfTownPerKm: 1.1 },
    phone: { href: 'tel:7003', label: 'Позвонить' },
    getLink: () => ({ href: 'https://taximaxim.by/', label: 'На сайт' }),
  },
];

function getPrice({ distanceKm, durationMin }: Route, tariff: Tariff) {
  const cityKm = Math.min(distanceKm, CITY_KM);
  const outOfTownKm = Math.max(distanceKm - CITY_KM, 0);
  const fare =
    tariff.minimum +
    Math.max(cityKm - tariff.includedKm, 0) * tariff.perKm +
    outOfTownKm * tariff.outOfTownPerKm +
    Math.max(durationMin - tariff.includedMin, 0) * tariff.perMin;

  return Math.round(fare * 100) / 100;
}

export function getOffers(route: Route, from: Place, to: Place): Offer[] {
  return SERVICES.map(({ name, tariffName, tariff, phone, getLink }) => ({
    name,
    tariffName,
    phone,
    link: getLink(from, to),
    price: getPrice(route, tariff),
  })).sort((a, b) => a.price - b.price);
}
