import { useEffect, useLayoutEffect, useRef } from 'react';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Global single-key shortcut (e.g. "n" for Quick Add).
 * Ignored while typing in a field, with modifier keys (Ctrl+N = new window),
 * or while a dialog is already open.
 */
export function useHotkey(key: string, handler: () => void): void {
  const handlerRef = useRef(handler);
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      handlerRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [key]);
}
