// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
  const HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/;
  const STATUS_ID_PATTERN = /^\d{1,25}$/;
  const ATLAS_URL = 'https://nostr-atlas.web.app';
  const INVITE_SELECTOR = 'button.nostr-zap-invite';
  const ICON = [
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
    '<path fill="currentColor" d="M11.2 1.5 3.2 13h5.4l-1.1 9.5 8.3-12.2h-5.5l.9-8.8z"/>',
    '<path fill="currentColor" d="M17.2 13.2h1.8v1.8h1.8v1.8h-1.8V18.6h-1.8v-1.8H15.4v-1.8h1.8z"/>',
    '</svg>'
  ].join('');

  function normalizeHandle(value) {
    const handle = String(value || '').trim().replace(/^@/, '').toLowerCase();
    return HANDLE_PATTERN.test(handle) ? handle : null;
  }

  /**
   * @returns {'zap'|'lightning'|'link'|'hidden'}
   */
  function classify(identity) {
    if (!identity || identity.source === 'unavailable') {
      return 'link';
    }
    const active = identity.activeIdentity;
    if (identity.verified === true && active?.zappable === true) {
      return extension.url?.isValidNpub?.(active.npub) === true ? 'zap' : 'hidden';
    }
    if (identity.verified === true) {
      return 'lightning';
    }
    return 'link';
  }

  function draftText(mode, handle) {
    if (mode === 'lightning') {
      return '@' + handle + ' This post is waiting on a place to send bitcoin. Add a Lightning address (name@domain) to your Nostr profile, from a wallet that accepts Nostr payments, and people can zap it.';
    }
    return '@' + handle + ' This post can carry more than the story. Link this account to your Nostr profile, add a Lightning address, and readers can zap you right from the thread. ' + ATLAS_URL;
  }

  function tooltip(mode, handle) {
    if (mode === 'lightning') {
      return 'Ask @' + handle + ' to add a Lightning address';
    }
    return 'Ask @' + handle + ' to link Nostr so people can zap this';
  }

  function replyUrl(slot, mode) {
    const handle = normalizeHandle(slot?.dataset?.authorHandle);
    const statusId = String(slot?.dataset?.statusId || '');
    if (!handle || !STATUS_ID_PATTERN.test(statusId)) {
      return null;
    }
    if (mode !== 'lightning' && mode !== 'link') {
      return null;
    }
    const url = new URL('https://x.com/intent/post');
    url.searchParams.set('in_reply_to', statusId);
    url.searchParams.set('text', draftText(mode, handle));
    return url.toString();
  }

  function findInvite(slot) {
    if (typeof slot.querySelector === 'function') {
      const found = slot.querySelector(INVITE_SELECTOR);
      if (found) return found;
    }
    const children = slot.children || [];
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (
        String(child?.tagName || '').toLowerCase() === 'button' &&
        child.className === 'nostr-zap-invite'
      ) {
        return child;
      }
    }
    return null;
  }

  function openReply(event) {
    event.preventDefault?.();
    event.stopPropagation?.();
    const button = event.currentTarget;
    const url = replyUrl(button?.parentElement, button?.getAttribute?.('data-invite-mode'));
    const opener = globalThis.window;
    if (!url || typeof opener?.open !== 'function') {
      return;
    }
    opener.open(url, '_blank', 'noopener,noreferrer');
  }

  function syncButton(slot, mode) {
    const existing = findInvite(slot);
    const handle = normalizeHandle(slot?.dataset?.authorHandle);
    if ((mode !== 'lightning' && mode !== 'link') || !handle) {
      existing?.remove?.();
      return null;
    }

    const button = existing || document.createElement('button');
    button.type = 'button';
    button.className = 'nostr-zap-invite';
    button.setAttribute('data-invite-mode', mode);
    button.setAttribute('data-theme', slot.dataset.theme === 'dark' ? 'dark' : 'light');
    const label = tooltip(mode, handle);
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.innerHTML = ICON;
    if (!existing) {
      button.addEventListener('click', openReply);
      slot.appendChild(button);
    }
    return button;
  }

  extension.zapInvite = {
    classify: classify,
    draftText: draftText,
    tooltip: tooltip,
    replyUrl: replyUrl,
    syncButton: syncButton
  };
})();
