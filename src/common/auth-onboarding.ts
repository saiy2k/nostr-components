// SPDX-License-Identifier: MIT

import { nip19 } from 'nostr-tools';
import type { DialogComponent } from '../base/dialog-component/dialog-component';
import '../base/dialog-component/dialog-component';
import { isValidHex } from './utils';
import { getAuthOnboardingDialogStyles } from './auth-onboarding-style';
import { getPublicKey } from './nostr-login-service';

type OnboardingAction = 'like' | 'zap' | 'follow';
type AdvancedInputKind = 'nsec' | 'bunker' | 'invalid';

interface ShowAuthOnboardingOptions {
  action: OnboardingAction;
  theme?: 'light' | 'dark';
}

interface ShowAuthOnboardingResult {
  connected: boolean;
  source: 'connect' | 'dismissed';
}

const ACTION_COPY: Record<
  OnboardingAction,
  { actionLabel: string; satsLine: string }
> = {
  like: {
    actionLabel: 'like this page on Nostr',
    satsLine: 'Creators can add zap buttons and receive sats directly on their websites.',
  },
  zap: {
    actionLabel: 'send a zap tip',
    satsLine: 'Zaps are instant Bitcoin Lightning tips. Anyone can receive sats on regular websites.',
  },
  follow: {
    actionLabel: 'follow this creator on Nostr',
    satsLine: 'Building on Nostr means creators can receive sats and own their audience graph.',
  },
};

function injectAuthOnboardingStyles(): void {
  if (document.querySelector('style[data-auth-onboarding-styles]')) return;

  const style = document.createElement('style');
  style.setAttribute('data-auth-onboarding-styles', 'true');
  style.textContent = getAuthOnboardingDialogStyles();
  document.head.appendChild(style);
}

function parseAdvancedInput(value: string): {
  kind: AdvancedInputKind;
  message: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      kind: 'invalid',
      message: 'Paste an nsec key or bunker:// token to validate the format.',
    };
  }

  if (trimmed.startsWith('bunker://')) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname && !parsed.pathname) {
        return {
          kind: 'invalid',
          message: 'Bunker token looks incomplete. Include host and query params.',
        };
      }
      return {
        kind: 'bunker',
        message: 'Valid bunker token format. Open your remote signer, then press Connect.',
      };
    } catch {
      return {
        kind: 'invalid',
        message: 'Invalid bunker:// token format.',
      };
    }
  }

  if (trimmed.startsWith('nsec1')) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'nsec') {
        return {
          kind: 'nsec',
          message: 'Valid nsec format. Import it into your signer app, then press Connect.',
        };
      }
      return {
        kind: 'invalid',
        message: 'This bech32 value is not an nsec key.',
      };
    } catch {
      return {
        kind: 'invalid',
        message: 'Invalid nsec format.',
      };
    }
  }

  if (isValidHex(trimmed)) {
    return {
      kind: 'nsec',
      message: 'Valid raw private key format. Import it into your signer app, then press Connect.',
    };
  }

  return {
    kind: 'invalid',
    message: 'Input is not recognized as nsec or bunker:// format.',
  };
}

export async function showAuthOnboarding(
  options: ShowAuthOnboardingOptions
): Promise<ShowAuthOnboardingResult> {
  injectAuthOnboardingStyles();

  if (!customElements.get('dialog-component')) {
    await customElements.whenDefined('dialog-component');
  }

  const copy = ACTION_COPY[options.action];
  const dialogComponent = document.createElement(
    'dialog-component'
  ) as DialogComponent;
  dialogComponent.setAttribute('header', 'Start with Nostr in 30 seconds');

  if (options.theme) {
    dialogComponent.setAttribute('data-theme', options.theme);
  }

  dialogComponent.innerHTML = `
    <div class="onboarding-flow">
      <section class="onboarding-hero">
        <h3>You are one click away from Nostr</h3>
        <p>
          To ${copy.actionLabel}, connect a signer once. ${copy.satsLine}
        </p>
      </section>

      <ol class="onboarding-steps">
        <li>Connect a signer using browser extension or remote signer.</li>
        <li>Approve this action from the signer prompt.</li>
        <li>Explore how to add zap buttons and receive sats on your own site.</li>
      </ol>

      <div class="onboarding-cta-row">
        <button type="button" class="onboarding-primary-btn">Connect Nostr</button>
        <button type="button" class="onboarding-secondary-btn">I need a quick setup guide</button>
        <button type="button" class="onboarding-skip-btn">Maybe later</button>
      </div>

      <div class="onboarding-links">
        <a href="https://nstart.me/" target="_blank" rel="noopener noreferrer">Get started with Nostr</a>
        <a href="https://getalby.com/" target="_blank" rel="noopener noreferrer">Install a signer extension</a>
      </div>

      <details class="onboarding-advanced">
        <summary>Advanced users: nsec or bunker validation</summary>
        <p>
          Paste an nsec key or bunker:// token to verify format before connecting with your signer flow.
        </p>
        <div class="onboarding-advanced-row">
          <input
            type="text"
            class="onboarding-advanced-input"
            placeholder="nsec1... or bunker://..."
            autocomplete="off"
          />
          <button type="button" class="onboarding-advanced-apply">Validate input</button>
        </div>
      </details>

      <div class="onboarding-status" aria-live="polite"></div>
    </div>
  `;

  dialogComponent.showModal();

  const dialogNodes = document.querySelectorAll<HTMLDialogElement>(
    '.nostr-base-dialog'
  );
  const dialog = dialogNodes[dialogNodes.length - 1];
  if (!dialog) {
    return { connected: false, source: 'dismissed' };
  }

  const connectButton = dialog.querySelector<HTMLButtonElement>(
    '.onboarding-primary-btn'
  );
  const setupGuideButton = dialog.querySelector<HTMLButtonElement>(
    '.onboarding-secondary-btn'
  );
  const skipButton = dialog.querySelector<HTMLButtonElement>(
    '.onboarding-skip-btn'
  );
  const advancedInput = dialog.querySelector<HTMLInputElement>(
    '.onboarding-advanced-input'
  );
  const advancedApplyButton = dialog.querySelector<HTMLButtonElement>(
    '.onboarding-advanced-apply'
  );
  const statusNode = dialog.querySelector<HTMLElement>('.onboarding-status');

  const setStatus = (message: string, kind: 'neutral' | 'error' | 'success') => {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.classList.remove('error', 'success');
    if (kind === 'error') statusNode.classList.add('error');
    if (kind === 'success') statusNode.classList.add('success');
  };

  return new Promise<ShowAuthOnboardingResult>((resolve) => {
    let settled = false;

    const settle = (result: ShowAuthOnboardingResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    dialog.addEventListener(
      'close',
      () => {
        settle({ connected: false, source: 'dismissed' });
      },
      { once: true }
    );

    setupGuideButton?.addEventListener('click', () => {
      window.open('https://nstart.me/', '_blank', 'noopener,noreferrer');
      setStatus('Setup guide opened in a new tab. Return and press Connect when ready.', 'neutral');
    });

    skipButton?.addEventListener('click', () => {
      dialogComponent.close();
      settle({ connected: false, source: 'dismissed' });
    });

    advancedApplyButton?.addEventListener('click', () => {
      const parsed = parseAdvancedInput(advancedInput?.value || '');
      if (parsed.kind === 'invalid') {
        setStatus(parsed.message, 'error');
        return;
      }
      setStatus(parsed.message, 'success');
    });

    connectButton?.addEventListener('click', async () => {
      connectButton.disabled = true;
      setStatus('Opening signer connection...', 'neutral');

      try {
        const pubkey = await getPublicKey();
        if (pubkey) {
          setStatus('Connected. Continuing action...', 'success');
          dialogComponent.close();
          settle({ connected: true, source: 'connect' });
          return;
        }

        setStatus(
          'Connection is still pending. Complete signer auth, then try Connect again.',
          'error'
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not start signer connection.';
        setStatus(message, 'error');
      } finally {
        connectButton.disabled = false;
      }
    });
  });
}
