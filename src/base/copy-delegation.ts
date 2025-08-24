import { copyToClipboard } from '../common/utils';

export function attachCopyDelegation(host: { delegateEvent: any; shadowRoot: ShadowRoot | null }) {
  // No-op if already attached by your delegateEvent guard
  host.delegateEvent('click', '.nc-copy-btn', async (e: Event) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const row = (btn as HTMLElement).closest('.nc-copy') as HTMLElement | null;
    const value = row?.dataset.copy ?? '';
    if (!value) return;

    try {
      await copyToClipboard(value);
      btn.classList.add('copied');
      const prev = btn.getAttribute('aria-label') || 'Copy';
      btn.setAttribute('aria-label', 'Copied!');
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.setAttribute('aria-label', prev);
      }, 1200);
    } catch {
      // optional: surface error // todo
    }
  });
}
