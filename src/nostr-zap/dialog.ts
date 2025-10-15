// SPDX-License-Identifier: MIT

import { getDialogStyles } from './dialog-style';

/**
 * Modal dialog helper for <nostr-zap> component.
 *
 * Adapted (simplified) from the original `nostr-zap` repository `view.js` file.
 * The goal is to give users a full-page modal with amount presets, QR-invoice,
 * wallet URI link, copy-to-clipboard, and success feedback – while keeping code
 * size reasonable for the component bundle.
 * 
 * NOTE: This dialog now receives pre-resolved npub from the component, eliminating
 * the need for redundant validation and resolution logic.
 */

import { 
  decodeNpub,
  fetchInvoice, 
  getProfileMetadata, 
  getZapEndpoint, 
  listenForZapReceipt 
} from './zap-utils';
import * as QRCode from 'qrcode';

interface WebLN {
  enable: () => Promise<void>;
  sendPayment: (invoice: string) => Promise<{ preimage: string }>;
}

declare global {
  interface Window {
    webln?: WebLN;
  }
}

export interface OpenZapModalParams {
  npub: string;
  relays: string;
  cachedAmountDialog?: HTMLDialogElement | null;
  buttonColor?: string;
  theme?: 'light' | 'dark';
  fixedAmount?: number; // if supplied, hide amount UI
  defaultAmount?: number; // preselect but allow change
  initialAmount?: number; // legacy support
  anon?: boolean;
}

/** Injects once – called from NostrZap.connectedCallback. */
export const injectCSS = (theme: 'light' | 'dark' = 'light') => {
  const shadow = ensureShadow();
  
  // Remove existing dialog styles
  const existingStyles = shadow.querySelectorAll('style[data-dialog-styles]');
  existingStyles.forEach(style => style.remove());
  
  const style = document.createElement('style');
  style.setAttribute('data-dialog-styles', 'true');
  style.textContent = getDialogStyles(theme);
  shadow.appendChild(style);
};

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
  const { npub, relays, cachedAmountDialog, buttonColor, fixedAmount, defaultAmount, initialAmount } = params;
  const npubHex = decodeNpub(npub);
  if (cachedAmountDialog) {
    // remove success class if it exists
    cachedAmountDialog.classList.remove('success');
    // show all controls that might have been hidden
    const controls = cachedAmountDialog.querySelectorAll('.amount-buttons, .update-zap-container, .comment-container, .cta-btn, .copy-btn');
    controls.forEach(el => {
      if (el instanceof HTMLElement) el.style.display = '';
    });
    // reset the update button
    const updateZapBtn = cachedAmountDialog.querySelector('.update-zap-btn') as HTMLButtonElement | null;
    if (updateZapBtn) updateZapBtn.style.display = '';
    // reset success overlay opacity if it was previously shown
    const successOverlay = cachedAmountDialog.querySelector('.success-overlay') as HTMLElement | null;
    if (successOverlay) {
      successOverlay.style.opacity = '0';
      successOverlay.style.pointerEvents = 'none';
    }

    cachedAmountDialog.showModal();
    return cachedAmountDialog;
  }

  // Minimal amount presets – feel free to tweak / add more later.
  const presets = [21, 100, 1000];
  let selectedAmount: number;
  if (typeof fixedAmount === 'number' && fixedAmount > 0) {
    selectedAmount = fixedAmount;
  } else if (typeof defaultAmount === 'number' && defaultAmount > 0) {
    selectedAmount = defaultAmount;
  } else if (typeof initialAmount === 'number' && initialAmount > 0) {
    selectedAmount = initialAmount;
  } else {
    selectedAmount = presets[0];
  }
  let customComment = '';
  let currentInvoice = '';
  let cleanupReceipt: (() => void) | null = null;

  // -----------------------------------------------------------------------------
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
      anon: params.anon ?? false,
    });
    currentInvoice = invoice;

    // Zap receipt listener
    const relaysArr = relays.split(',');
    cleanupReceipt = listenForZapReceipt({ relays: relaysArr, receiversPubKey: npubHex, invoice: invoice, onSuccess: markSuccess });
  }

  async function qrImgSrc(invoice: string): Promise<string> {
    try {
      // Generate QR code as a data URL (base64 encoded image)
      return await QRCode.toDataURL(invoice, {
        width: 240,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      // Fallback to text representation if QR generation fails
      return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 100 100">
        <rect width="100%" height="100%" fill="white"/>
        <text x="50%" y="50%" font-family="monospace" font-size="10" text-anchor="middle" dominant-baseline="middle" fill="black">
          Invoice: ${invoice.substring(0, 10)}...
        </text>
      </svg>`;
    }
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
    dialog.classList.add('loading');
    try {
      await loadInvoice(selectedAmount, customComment);
      const qrImg = dialog.querySelector('img.qr') as HTMLImageElement;
      qrImgSrc(currentInvoice).then(src => {
        qrImg.src = src;
      });

      const payBtn = dialog.querySelector('.cta-btn') as HTMLButtonElement;
      payBtn.disabled = false;
    } finally {
      dialog.classList.remove('loading');
    }
  }

  // ---------------------------------------------------------------------------
  // Build dialog DOM
  // ---------------------------------------------------------------------------

  injectCSS(params.theme || 'light');
  const shadow = ensureShadow();

  const dialog = document.createElement('dialog');
  dialog.className = 'nostr-zap-dialog' + (params.theme === 'dark' ? ' dark' : '');

  const amountButtonsHtml = presets
    .map(a => `<button type="button" data-val="${a}">${a} ⚡</button>`) // show sat symbol
    .join('');

  const hideAmountUI = typeof fixedAmount === 'number' && fixedAmount > 0;

  dialog.innerHTML = `
      <button class="close-btn">✕</button>
      <h2>Send a Zap</h2>
      ${hideAmountUI ? '' : `<div class="amount-buttons">${amountButtonsHtml}</div>`}
      ${hideAmountUI ? `<p class="zapping-amount">Zapping ${fixedAmount} sats</p>` : ''}
      ${hideAmountUI ? '' : `<div class="update-zap-container">
        <input type="number" min="1" placeholder="Custom sats" class="custom-amount" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px" />
        <button type="button" class="update-zap-btn" style="padding:8px 12px;border:none;border-radius:6px;background:#7f00ff;color:#fff">Update Zap</button>
      </div>`}
      ${hideAmountUI ? '' : `<div class="comment-container">
        <input type="text" placeholder="Comment (optional)" class="comment-input" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px" />
        <button type="button" class="add-comment-btn" style="padding:8px 12px;border:none;border-radius:6px;background:#7f00ff;color:#fff">Add</button>
      </div>`}
      <img class="qr" width="240" height="240" alt="QR" style="cursor:pointer" />
      <br />
      <button type="button" class="copy-btn">Copy invoice</button>
      <button type="button" class="cta-btn" disabled>Open in wallet</button>
      <div class="loading-overlay"><div class="loader"></div></div>
      <div class="success-overlay">⚡ Thank you!</div>
  `;

  shadow.appendChild(dialog);

  // Event wiring - moved listener setup to after initial invoice load
  const amountContainer = dialog.querySelector('.amount-buttons') as HTMLElement | null;
  if (amountContainer)
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
  const customAmountInput = dialog.querySelector('.custom-amount') as HTMLInputElement | null;
  if (customAmountInput) customAmountInput.addEventListener('input', async e => {
    const val = Number((e.target as HTMLInputElement).value);
    if (val > 0) {
      selectedAmount = val;
      if (amountContainer) setActiveAmountButtons(amountContainer, -1); // clear presets highlight
      const payBtn = dialog.querySelector('.cta-btn') as HTMLButtonElement;
      payBtn.disabled = true; // will be enabled after Update Zap
    }
  });

  const commentInput = dialog.querySelector('.comment-input') as HTMLInputElement | null;
  if (commentInput) commentInput.addEventListener('input', e => {
    customComment = (e.target as HTMLInputElement).value.slice(0, 200);
  });

  (dialog.querySelector('.close-btn') as HTMLButtonElement).onclick = () => dialog.close();

  const copyInvoice = async () => {
    if (!currentInvoice) return;
    await navigator.clipboard.writeText(currentInvoice);
    (dialog.querySelector('.copy-btn') as HTMLButtonElement).textContent = 'Copied!';
    setTimeout(() => {
      (dialog.querySelector('.copy-btn') as HTMLButtonElement).textContent = 'Copy invoice';
    }, 1500);
  };
  (dialog.querySelector('.copy-btn') as HTMLButtonElement).onclick = copyInvoice;
  (dialog.querySelector('img.qr') as HTMLImageElement).onclick = copyInvoice;

  // Update zap button
  const updateZapBtn = dialog.querySelector('.update-zap-btn') as HTMLButtonElement | null;
  if (updateZapBtn) updateZapBtn.addEventListener('click', async () => {
    const val = Number(customAmountInput?.value);
    if (!isNaN(val) && val > 0) {
      selectedAmount = val;
      updateZapBtn.disabled = true;
      await refreshUI(dialog);
      updateZapBtn.disabled = false;
    }
  });

  const addCommentBtn = dialog.querySelector('.add-comment-btn') as HTMLButtonElement | null;
  if (addCommentBtn) addCommentBtn.addEventListener('click', async () => {
    addCommentBtn.disabled = true;
    await refreshUI(dialog);
    addCommentBtn.disabled = false;
  });

  (dialog.querySelector('.cta-btn') as HTMLButtonElement).onclick = async () => {
    if (!currentInvoice) return;
    // try WebLN first
    if (window.webln) {
      try {
        await window.webln.enable();
        await window.webln.sendPayment(currentInvoice);
        markSuccess();
        return;
      } catch (e) {
        console.error('Nostr-Components: Zap button: webln payment failed', e);
        dialog.close();
      }
    }
    window.location.href = `lightning:${currentInvoice}`;
  };

  function markSuccess() {
    dialog.classList.add('success');
    const overlay = dialog.querySelector('.success-overlay') as HTMLElement;
    overlay.style.opacity = '1';
    // Ensure overlay does not block interactions (close button)
    overlay.style.pointerEvents = 'none';
    // hide other controls for clarity
    const controls = dialog.querySelectorAll('.amount-buttons, .update-zap-container, .comment-container, .cta-btn, .copy-btn');
    controls.forEach(el => {
      if (el instanceof HTMLElement) el.style.display = 'none';
    });
    // ensure close button is still clickable
    const closeBtn = dialog.querySelector('.close-btn') as HTMLElement;
    if (closeBtn) closeBtn.style.pointerEvents = 'auto';
  }

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
  
  // Now that we have an invoice, set up the receipt listener
  if (currentInvoice) {
    const relaysArr = relays.split(',');
    cleanupReceipt = listenForZapReceipt({
      relays: relaysArr,
      receiversPubKey: npubHex,
      invoice: currentInvoice,
      onSuccess: markSuccess
    });
  }
  
  if (amountContainer && presets.includes(selectedAmount)) {
    setActiveAmountButtons(amountContainer, selectedAmount);
  } else if (!hideAmountUI) {
    const input = dialog.querySelector('.custom-amount') as HTMLInputElement | null;
    if (input) input.value = String(selectedAmount);
    if (amountContainer) setActiveAmountButtons(amountContainer, -1);
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
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 125 ? '#000' : '#fff';
}
