import { useEffect, useState } from 'react';

// На iPhone клавиатура перекрывает страницу, не меняя её размер: считаем высоту сами.
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      setInset(Math.max(window.innerHeight - viewport.height - viewport.offsetTop, 0));
    };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
