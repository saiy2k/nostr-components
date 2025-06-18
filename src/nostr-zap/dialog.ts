/**
 * Modal dialog helper for <nostr-zap> component.
 *
 * Adapted (simplified) from the original `nostr-zap` repository `view.js` file.
 * The goal is to give users a full-page modal with amount presets, QR-invoice,
 * wallet URI link, copy-to-clipboard, and success feedback – while keeping code
 * size reasonable for the component bundle.
 */

import {
  decodeNpub,
  getProfileMetadata,
  getZapEndpoint,
  fetchInvoice,
  listenForZapReceipt,
} from './zap-utils';

export interface OpenZapModalParams {
  npub: string;
  relays: string; // comma-separated list coming from component
  cachedAmountDialog?: HTMLDialogElement | null;
  buttonColor?: string;
  initialAmount?: number;
  anon?: boolean;
}

/** Injects once – called from NostrZap.connectedCallback. */
export const injectCSS = (() => {
  let injected = false;
  return () => {
    if (injected) return;
    injected = true;

    const style = document.createElement('style');
    style.textContent = `
      .nostr-zap-dialog{width:424px;max-width:90vw;border:none;border-radius:10px;padding:24px 32px;background:#fff;color:#000;position:relative;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,'Open Sans','Helvetica Neue',sans-serif;text-align:center}
      .nostr-zap-dialog[open]{display:block}
      .nostr-zap-dialog h2{font-size:1.25rem;font-weight:700;margin:4px 0}
      .nostr-zap-dialog p{margin:4px 0;word-break:break-word}
      .nostr-zap-dialog .amount-buttons{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 8px}
      .nostr-zap-dialog .amount-buttons button{flex:1 1 30%;min-width:72px;padding:8px 0;border:1px solid #e2e8f0;border-radius:6px;background:#f7fafc;cursor:pointer;font-size:14px}
      .nostr-zap-dialog .amount-buttons button.active{background:#7f00ff;color:#fff}
      .nostr-zap-dialog .cta-btn{width:100%;padding:10px 0;border:none;border-radius:6px;font-size:16px;margin-top:16px;cursor:pointer;background:#7f00ff;color:#fff}
      .nostr-zap-dialog .close-btn{position:absolute;top:8px;right:8px;border:none;background:#f7fafc;border-radius:50%;width:36px;height:36px;font-size:18px;cursor:pointer}
      .nostr-zap-dialog img.qr{margin-top:16px;border:1px solid #e2e8f0;border-radius:8px}
      .nostr-zap-dialog .copy-btn{margin-top:12px;cursor:pointer;font-size:14px;background:none;border:none;color:#7f00ff}
      .nostr-zap-dialog .success-overlay{position:absolute;inset:0;background:rgba(0,0,0,.65);display:flex;justify-content:center;align-items:center;color:#fff;font-size:24px;border-radius:10px;opacity:0;transition:opacity .3s ease;pointer-events:none}
      .nostr-zap-dialog.success .success-overlay{opacity:1;pointer-events:auto}
    `;
    ensureShadow().appendChild(style);
  };
})();

let _shadowRoot: ShadowRoot | null = null;
function ensureShadow() {
  if (_shadowRoot) return _shadowRoot;
  const host = document.createElement('div');
  document.body.appendChild(host);
  _shadowRoot = host.attachShadow({ mode: 'open' });
  return _shadowRoot;
}

/**
 * Opens (or re-opens) the zap modal. Returns the dialog element so the caller
 * can cache it between clicks.
 */
export async function init(params: OpenZapModalParams): Promise<HTMLDialogElement> {
  const { npub, relays, cachedAmountDialog, buttonColor, initialAmount } = params;
  if (cachedAmountDialog) {
    cachedAmountDialog.showModal();
    return cachedAmountDialog;
  }

  // Minimal amount presets – feel free to tweak / add more later.
  const presets = [21, 100, 1000];
  let selectedAmount = typeof initialAmount === 'number' && initialAmount > 0 ? initialAmount : presets[0];
  let customComment = '';
  let currentInvoice = '';
  let cleanupReceipt: (() => void) | null = null;

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  async function loadInvoice(amountSats: number, comment: string) {
    const authorId = decodeNpub(npub);
    const meta = await getProfileMetadata(authorId);
    const endpoint = await getZapEndpoint(meta);
    const invoice = await fetchInvoice({
      zapEndpoint: endpoint,
      amount: amountSats * 1000, // -> msats
      comment,
      authorId,
      nip19Target: undefined,
      normalizedRelays: relays.split(','),
      anon: false,
    });
    currentInvoice = invoice;
  }

  function qrImgSrc(invoice: string) {
    const encoded = encodeURIComponent(invoice);
    // free qrserver – sufficient for demo / testing
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encoded}`;
  }

  function setActiveAmountButtons(container: HTMLElement, amt: number) {
    container.querySelectorAll('button').forEach(btn => {
      if ((btn as HTMLButtonElement).dataset['val'] === String(amt)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  async function refreshUI(dialog: HTMLDialogElement) {
    await loadInvoice(selectedAmount, customComment);
    const qrImg = dialog.querySelector('img.qr') as HTMLImageElement;
    qrImg.src = qrImgSrc(currentInvoice);

    const payBtn = dialog.querySelector('.cta-btn') as HTMLButtonElement;
    payBtn.disabled = false;
  }

  // ---------------------------------------------------------------------------
  // Build dialog DOM
  // ---------------------------------------------------------------------------

  injectCSS();
  const shadow = ensureShadow();

  const dialog = document.createElement('dialog');
  dialog.className = 'nostr-zap-dialog';

  const amountButtonsHtml = presets
    .map(a => `<button type="button" data-val="${a}">${a} ⚡</button>`) // show sat symbol
    .join('');

  dialog.innerHTML = `
      <button class="close-btn">✕</button>
      <h2>Send a Zap</h2>
      <div class="amount-buttons">${amountButtonsHtml}</div>
      <div style="margin-top:8px">
        <input type="number" min="1" placeholder="Custom sats" class="custom-amount" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px" />
      </div>
      <div style="margin-top:8px">
        <input type="text" placeholder="Comment (optional)" class="comment-input" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px" />
      </div>
      <img class="qr" width="240" height="240" alt="QR" />
      <br />
      <button type="button" class="copy-btn">Copy invoice</button>
      <button type="button" class="cta-btn" disabled>Open in wallet</button>
      <div class="success-overlay">⚡ Thank you!</div>
  `;

  shadow.appendChild(dialog);

  // Event wiring
  const amountContainer = dialog.querySelector('.amount-buttons') as HTMLElement;
  amountContainer.addEventListener('click', async e => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON') {
      const val = Number(target.dataset['val']);
      if (!isNaN(val)) {
        selectedAmount = val;
        setActiveAmountButtons(amountContainer, val);
        const payBtn = dialog.querySelector('.cta-btn') as HTMLButtonElement;
        payBtn.disabled = true; // disable until new invoice fetched
        await refreshUI(dialog);
      }
    }
  });

  // custom amount change
  (dialog.querySelector('.custom-amount') as HTMLInputElement).addEventListener('input', async e => {
    const val = Number((e.target as HTMLInputElement).value);
    if (val > 0) {
      selectedAmount = val;
      setActiveAmountButtons(amountContainer, -1); // clear presets highlight
      const payBtn = dialog.querySelector('.cta-btn') as HTMLButtonElement;
      payBtn.disabled = true;
      await refreshUI(dialog);
    }
  });

  (dialog.querySelector('.comment-input') as HTMLInputElement).addEventListener('input', e => {
    customComment = (e.target as HTMLInputElement).value.slice(0, 200);
  });

  (dialog.querySelector('.close-btn') as HTMLButtonElement).onclick = () => dialog.close();

  (dialog.querySelector('.copy-btn') as HTMLButtonElement).onclick = async () => {
    if (!currentInvoice) return;
    await navigator.clipboard.writeText(currentInvoice);
    (dialog.querySelector('.copy-btn') as HTMLButtonElement).textContent = 'Copied!';
    setTimeout(() => {
      (dialog.querySelector('.copy-btn') as HTMLButtonElement).textContent = 'Copy invoice';
    }, 1500);
  };

  (dialog.querySelector('.cta-btn') as HTMLButtonElement).onclick = async () => {
    if (!currentInvoice) return;
    // try WebLN first
    // @ts-ignore
    if (window.webln) {
      try {
        // @ts-ignore
        await window.webln.enable();
        // @ts-ignore
        await window.webln.sendPayment(currentInvoice);
        markSuccess();
        return;
      } catch {
        // fall-through
      }
    }
    window.location.href = `lightning:${currentInvoice}`;
  };

  function markSuccess() {
    dialog.classList.add('success');
    const overlay = dialog.querySelector('.success-overlay') as HTMLElement;
    overlay.style.opacity = '1';
    setTimeout(() => dialog.close(), 1800);
  }

  // Zap receipt listener
  const relaysArr = relays.split(',');
  cleanupReceipt = listenForZapReceipt({ relays: relaysArr, invoice: currentInvoice, onSuccess: markSuccess });

  dialog.addEventListener('close', () => {
    if (cleanupReceipt) cleanupReceipt();
  });

  // Color customisation (buttonColor background)
  if (buttonColor) {
    const btnColor = buttonColor;
    (dialog.querySelector('.cta-btn') as HTMLButtonElement).style.background = btnColor;
    (dialog.querySelector('.cta-btn') as HTMLButtonElement).style.color = getContrastingTextColor(btnColor);
  }

  // Load first invoice & show
  await refreshUI(dialog);
  if (presets.includes(selectedAmount)) {
    setActiveAmountButtons(amountContainer, selectedAmount);
  } else {
    (dialog.querySelector('.custom-amount') as HTMLInputElement).value = String(selectedAmount);
    setActiveAmountButtons(amountContainer, -1);
  }
  dialog.showModal();

  return dialog;
}

// -----------------------------------------------------------------------------
// Helper – compute readable text colour for custom bg
// -----------------------------------------------------------------------------
function getContrastingTextColor(hex: string): string {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(ch => ch + ch)
      .join('');
  }
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 125 ? '#000' : '#fff';
}
