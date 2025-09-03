import { copyToClipboard } from '../common/utils';

interface DelegatedHost {
    addDelegatedListener(
      type: string,
      selector: string,
      handler: (e: Event) => void
    ): void;
  }

export function attachCopyDelegation(host: DelegatedHost) {
  host.addDelegatedListener('click', '.nc-copy-btn', async (e: Event) => {
    e.stopPropagation();
    const btn = (e.target as HTMLElement)?.closest('.nc-copy-btn') as HTMLElement;
    if (!btn) return;
    const row = btn?.closest('.nc-copy') as HTMLElement | null;
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
