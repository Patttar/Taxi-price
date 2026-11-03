import { useRef, useState, type AnimationEvent } from 'react';

// Шторку сначала закрываем с анимацией и только потом сообщаем наружу, иначе она пропадает рывком.
export function useClosingSheet(onClose: () => void) {
  const [isOpen, setIsOpen] = useState(true);
  const afterCloseRef = useRef(onClose);

  function close(afterClose: () => void = onClose) {
    afterCloseRef.current = afterClose;
    setIsOpen(false);
  }

  function onAnimationEnd(event: AnimationEvent<HTMLElement>) {
    if (event.target === event.currentTarget && event.currentTarget.dataset.state === 'closed') {
      afterCloseRef.current();
    }
  }

  return { isOpen, close, onAnimationEnd };
}

export const SHEET_OVERLAY_ANIMATION =
  'animate-in fade-in-0 duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200';

export const SHEET_CONTENT_ANIMATION =
  'animate-in slide-in-from-bottom duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200 data-[state=closed]:ease-in';
