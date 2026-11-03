import { useRef, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

const CLOSE_DISTANCE = 96;
const CLOSE_SPEED = 0.6; // px/ms
const FLING_DISTANCE = 32;
const SPEED_WINDOW_MS = 100;
const TAP_TOLERANCE = 6;
const ANIMATION_MS = 200;

// Шторку тянут за верхнюю полоску: смахивание по всей шторке спорит с прокруткой и полями.
// getClosedTransform — куда уезжает шторка: по умолчанию за нижний край экрана.
export function useSwipeToClose<T extends HTMLElement>(
  onClose: () => void,
  getClosedTransform = () => 'translateY(100dvh)',
) {
  const sheetRef = useRef<T>(null);
  const wasDraggedRef = useRef(false);

  function onPointerDown(event: ReactPointerEvent) {
    const sheet = sheetRef.current;
    if (!sheet || event.button !== 0) return;

    const startY = event.clientY;
    let shift = 0;
    // Скорость считаем по последним движениям, а не по одному кадру: иначе дрожание пальца выглядит как бросок.
    let samples = [{ y: startY, time: event.timeStamp }];
    wasDraggedRef.current = false;

    function move(moveEvent: PointerEvent) {
      if (!sheet) return;
      shift = Math.max(0, moveEvent.clientY - startY);
      samples = [...samples, { y: moveEvent.clientY, time: moveEvent.timeStamp }].filter(
        ({ time }) => moveEvent.timeStamp - time <= SPEED_WINDOW_MS,
      );
      if (shift > TAP_TOLERANCE) wasDraggedRef.current = true;
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${shift}px)`;
    }

    function end(endEvent: PointerEvent) {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (!sheet || !wasDraggedRef.current) {
        if (sheet) sheet.style.transform = '';
        return;
      }

      const [first, last] = [samples[0], samples.at(-1)!];
      const speed = (last.y - first.y) / Math.max(last.time - first.time, SPEED_WINDOW_MS / 2);
      const isHeld = endEvent.timeStamp - last.time > SPEED_WINDOW_MS;
      const isFling = shift > FLING_DISTANCE && speed > CLOSE_SPEED && !isHeld;

      sheet.style.transition = `transform ${ANIMATION_MS}ms ease-out`;
      if (shift > CLOSE_DISTANCE || isFling) {
        sheet.style.transform = getClosedTransform();
        setTimeout(() => {
          onClose();
          sheet.style.transition = '';
          sheet.style.transform = '';
        }, ANIMATION_MS);
      } else {
        sheet.style.transform = '';
      }
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  // После перетаскивания палец отпускают над кнопкой, и браузер считает это нажатием.
  function onClickCapture(event: MouseEvent) {
    if (!wasDraggedRef.current) return;
    wasDraggedRef.current = false;
    event.stopPropagation();
    event.preventDefault();
  }

  return { sheetRef, handleProps: { onPointerDown, onClickCapture } };
}
