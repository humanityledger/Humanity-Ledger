/**
 * lib/chat/reveal-message.ts
 *
 * Scrolls to a message by id. The message list mounts only a window of the newest messages
 * (components/chat/VirtualizedMessageList.tsx), so an older target may not be in the DOM: the
 * list is asked to mount it first, then the scroll runs on the next frames.
 */
export const REVEAL_MESSAGE_EVENT = 'hl:reveal-message';

export function revealMessage(id: string, onFound?: (el: HTMLElement) => void): void {
  if (typeof document === 'undefined' || !id) return;
  const go = (el: HTMLElement) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    onFound?.(el);
  };
  const now = document.getElementById(`msg-${id}`);
  if (now) return go(now);
  window.dispatchEvent(new CustomEvent(REVEAL_MESSAGE_EVENT, { detail: { id } }));
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${id}`);
      if (el) go(el);
    }),
  );
}
