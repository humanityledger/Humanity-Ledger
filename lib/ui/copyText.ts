/**
 * Copy text to the clipboard on every browser: the async Clipboard API where
 * allowed, else a hidden textarea + execCommand (older iOS Safari, insecure
 * contexts, some in-app wallet browsers). Resolves true when it copied.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || !text) return false;
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
