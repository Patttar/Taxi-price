let loading: Promise<typeof ymaps> | undefined;

export function loadYandexMaps() {
  loading ??= new Promise((resolve, reject) => {
    const params = new URLSearchParams({ lang: 'ru_RU' });
    const apiKey = import.meta.env.VITE_YANDEX_MAPS_KEY;
    if (apiKey) params.set('apikey', apiKey);

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?${params}`;
    script.onload = () => ymaps.ready(() => resolve(ymaps));
    script.onerror = () => {
      loading = undefined;
      script.remove();
      reject(new Error('Yandex Maps failed to load'));
    };
    document.head.append(script);
  });

  return loading;
}
