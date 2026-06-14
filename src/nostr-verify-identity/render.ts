// SPDX-License-Identifier: MIT

import { escapeHtml } from '../common/utils';
import { IRenderOptions } from '../base/render-options';

export type VerifyStep = 'connect' | 'proof' | 'verify' | 'done';

export interface RenderVerifyOptions extends IRenderOptions {
  step: VerifyStep;
  platform: string;
  /** Handle value (may be empty until the user types one). */
  handle: string;
  /** The user's npub, once connected. */
  npub: string;
  /** Proof text the user should post. */
  proofText: string;
  /** "post a tweet" intent URL, prefilled. */
  intentUrl: string;
  /** Draft proof tweet URL/status id while the user is retrying verification. */
  proofUrl?: string;
  /** Verified handle + tweet id, shown on the success screen. */
  verifiedHandle?: string;
  proofTweetId?: string;
  publishedKinds?: number[];
  theme?: 'light' | 'dark';
}

export function renderVerifyIdentity(o: RenderVerifyOptions): string {
  if (o.isError) {
    return shell(errorBanner(o.errorMessage || 'Something went wrong.') + bodyForStep(o));
  }
  return shell(bodyForStep(o));
}

function shell(inner: string): string {
  return `<div class="nc-verify">${inner}</div>`;
}

function bodyForStep(o: RenderVerifyOptions): string {
  switch (o.step) {
    case 'connect':
      return connectStep(o);
    case 'proof':
      return proofStep(o);
    case 'verify':
      return proofStep(o); // same form; the button shows a spinner via isLoading
    case 'done':
      return doneStep(o);
    default:
      return connectStep(o);
  }
}

function header(platform: string): string {
  const label = platform.charAt(0).toUpperCase() + platform.slice(1);
  return `
    <div class="nc-verify-header">
      <span class="nc-verify-title">Verify your ${escapeHtml(label)} identity</span>
      <span class="nc-verify-sub">Link it to your Nostr key with a NIP-39 proof</span>
    </div>`;
}

function connectStep(o: RenderVerifyOptions): string {
  return `
    ${header(o.platform)}
    <p class="nc-verify-text">
      Connect your Nostr account to start. You'll post a short proof on
      ${escapeHtml(cap(o.platform))} and publish a signed identity tag.
    </p>
    <button class="nc-verify-btn nc-verify-primary" data-action="connect" ${o.isLoading ? 'disabled' : ''}>
      ${o.isLoading ? spinner() + 'Connecting…' : 'Connect Nostr'}
    </button>`;
}

function proofStep(o: RenderVerifyOptions): string {
  return `
    ${header(o.platform)}
    <ol class="nc-verify-steps">
      <li>
        <span class="nc-verify-step-label">1. Post this proof on ${escapeHtml(cap(o.platform))}</span>
        <pre class="nc-verify-proof">${escapeHtml(o.proofText)}</pre>
        <div class="nc-verify-row">
          <button class="nc-verify-btn nc-verify-ghost" data-action="copy-proof">Copy text</button>
          <a class="nc-verify-btn nc-verify-ghost" href="${escapeHtml(o.intentUrl)}" target="_blank" rel="noopener noreferrer">Open ${escapeHtml(cap(o.platform))} ↗</a>
        </div>
      </li>
      <li>
        <label class="nc-verify-step-label" for="nc-proof-url">2. Paste the link to your proof post</label>
        <input id="nc-proof-url" class="nc-verify-input" type="text" name="proof-url"
          placeholder="https://x.com/${escapeHtml(o.handle || 'yourhandle')}/status/…"
          value="${escapeHtml(o.proofUrl || '')}"
          ${o.isLoading ? 'disabled' : ''} />
        <span class="nc-verify-hint">A tweet URL or the numeric status id both work.</span>
      </li>
    </ol>
    <button class="nc-verify-btn nc-verify-primary" data-action="verify" ${o.isLoading ? 'disabled' : ''}>
      ${o.isLoading ? spinner() + 'Verifying…' : 'Verify & publish'}
    </button>
    <p class="nc-verify-npub">Linking to <code>${escapeHtml(short(o.npub))}</code></p>`;
}

function doneStep(o: RenderVerifyOptions): string {
  const kinds = (o.publishedKinds || []).map((k) => `kind:${k}`).join(' + ') || 'kind:10011';
  return `
    <div class="nc-verify-done">
      <div class="nc-verify-check">✓</div>
      <span class="nc-verify-title">Identity verified</span>
      <p class="nc-verify-text">
        <code>@${escapeHtml(o.verifiedHandle || o.handle)}</code> is now cryptographically
        linked to <code>${escapeHtml(short(o.npub))}</code>.
      </p>
      <p class="nc-verify-hint">Published a NIP-39 <code>i</code> tag to ${escapeHtml(kinds)}.</p>
      <button class="nc-verify-btn nc-verify-ghost" data-action="reset">Verify another</button>
    </div>`;
}

function errorBanner(message: string): string {
  return `<div class="nc-verify-error">⚠ ${escapeHtml(message)}</div>`;
}

function spinner(): string {
  return `<span class="nc-verify-spinner" aria-hidden="true"></span>`;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function short(npub: string): string {
  if (!npub) return '';
  return npub.length > 20 ? `${npub.slice(0, 12)}…${npub.slice(-6)}` : npub;
}
