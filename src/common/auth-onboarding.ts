// SPDX-License-Identifier: MIT

import type { Theme } from './types';
import {
  ensureInitialized,
  getPublicKey,
} from './nostr-login-service';
import { getAuthOnboardingDialogStyles } from './auth-onboarding-style';

export type AuthAction = 'like' | 'zap' | 'follow';
export type EnsureSignerStatus =
  | 'already-connected'
  | 'connected'
  | 'dismissed'
  | 'unavailable';

interface AuthOnboardingContent {
  eyebrow: string;
  title: string;
  description: string;
  whyItMatters: string;
}

interface ShowAuthOnboardingOptions {
  action: AuthAction;
  theme?: Theme;
}

interface ShowAuthOnboardingResult {
  status: 'connect' | 'dismissed';
}

interface DialogComponentElement extends HTMLElement {
  showModal(): void;
  close(): void;
  getDialogElement(): HTMLDialogElement | null;
}

export interface EnsureSignerForActionOptions {
  action: AuthAction;
  theme?: Theme;
}

export interface EnsureSignerForActionResult {
  status: EnsureSignerStatus;
  publicKey: string | null;
  message?: string;
}

interface EnsureSignerDependencies {
  ensureInitialized: typeof ensureInitialized;
  getPublicKey: typeof getPublicKey;
  showAuthOnboarding: (options: ShowAuthOnboardingOptions) => Promise<ShowAuthOnboardingResult>;
}

const QUICK_SETUP_URL = 'https://nstart.me/';
const SIGNER_INSTALL_URL = 'https://getalby.com/';

const ACTION_CONTENT: Record<AuthAction, AuthOnboardingContent> = {
  like: {
    eyebrow: 'Open social proof',
    title: 'Save your likes on Nostr',
    description:
      'Connect a Nostr signer once to like this page and carry your reactions with you across the web.',
    whyItMatters:
      'Nostr gives regular websites a shared social layer, and creators can add zap buttons to receive sats directly.',
  },
  zap: {
    eyebrow: 'Instant Lightning tips',
    title: 'Send sats in a couple of clicks',
    description:
      'Connect a Nostr signer once to send a zap. Zaps are instant Bitcoin Lightning tips that go straight to creators.',
    whyItMatters:
      'This same setup lets creators add zap buttons to their own sites and receive sats without a platform in the middle.',
  },
  follow: {
    eyebrow: 'Portable audience graph',
    title: 'Follow creators without platform lock-in',
    description:
      'Connect a Nostr signer once to follow this creator and keep that relationship in your own account, not inside one app.',
    whyItMatters:
      'Creators can own their audience and add sats-enabled actions on regular websites instead of depending on one platform.',
  },
};

let activeOnboardingPromise: Promise<ShowAuthOnboardingResult> | null = null;

function injectAuthOnboardingStyles(): void {
  if (document.querySelector('style[data-auth-onboarding-styles]')) return;

  const style = document.createElement('style');
  style.setAttribute('data-auth-onboarding-styles', 'true');
  style.textContent = getAuthOnboardingDialogStyles();
  document.head.appendChild(style);
}

export function getAuthOnboardingContent(
  action: AuthAction
): AuthOnboardingContent {
  return ACTION_CONTENT[action];
}

export function getAuthOnboardingLinks() {
  return {
    quickSetupUrl: QUICK_SETUP_URL,
    signerInstallUrl: SIGNER_INSTALL_URL,
  };
}

export function getSignerUnavailableMessage(action: AuthAction): string {
  switch (action) {
    case 'like':
      return 'Connect a Nostr signer to like this page.';
    case 'zap':
      return 'Connect a Nostr signer to send a zap.';
    case 'follow':
      return 'Connect a Nostr signer to follow this profile.';
    default:
      return 'Connect a Nostr signer to continue.';
  }
}

function normalizeOnboardingTheme(theme?: Theme): 'light' | 'dark' {
  return theme === 'dark' ? 'dark' : 'light';
}

export function createEnsureSignerForAction(
  dependencies: EnsureSignerDependencies = {
    ensureInitialized,
    getPublicKey,
    showAuthOnboarding,
  }
) {
  return async function ensureSignerForAction(
    options: EnsureSignerForActionOptions
  ): Promise<EnsureSignerForActionResult> {
    try {
      await dependencies.ensureInitialized();
    } catch (error) {
      console.error('[AuthOnboarding] Failed to initialize signer flow:', error);
      return {
        status: 'unavailable',
        publicKey: null,
        message: getSignerUnavailableMessage(options.action),
      };
    }

    try {
      const existingPubKey = await dependencies.getPublicKey();
      if (existingPubKey) {
        return {
          status: 'already-connected',
          publicKey: existingPubKey,
        };
      }

      const onboardingResult = await dependencies.showAuthOnboarding(options);
      if (onboardingResult.status === 'dismissed') {
        return {
          status: 'dismissed',
          publicKey: null,
        };
      }

      const connectedPubKey = await dependencies.getPublicKey();
      if (connectedPubKey) {
        return {
          status: 'connected',
          publicKey: connectedPubKey,
        };
      }

      return {
        status: 'unavailable',
        publicKey: null,
        message: getSignerUnavailableMessage(options.action),
      };
    } catch (error) {
      console.error('[AuthOnboarding] Failed during signer onboarding:', error);
      return {
        status: 'unavailable',
        publicKey: null,
        message: getSignerUnavailableMessage(options.action),
      };
    }
  };
}

export const ensureSignerForAction = createEnsureSignerForAction();

export async function showAuthOnboarding(
  options: ShowAuthOnboardingOptions
): Promise<ShowAuthOnboardingResult> {
  if (activeOnboardingPromise) {
    return activeOnboardingPromise;
  }

  activeOnboardingPromise = (async () => {
    injectAuthOnboardingStyles();
    await import('../base/dialog-component/dialog-component');
    await customElements.whenDefined('dialog-component');

    const theme = normalizeOnboardingTheme(options.theme);
    const content = getAuthOnboardingContent(options.action);
    const links = getAuthOnboardingLinks();

    const dialogComponent = document.createElement(
      'dialog-component'
    ) as DialogComponentElement;
    dialogComponent.setAttribute('header', 'Start with Nostr in seconds');
    dialogComponent.setAttribute('data-theme', theme);
    dialogComponent.innerHTML = `
      <div class="auth-onboarding">
        <section class="auth-onboarding-hero">
          <div class="auth-onboarding-eyebrow">${content.eyebrow}</div>
          <h3>${content.title}</h3>
          <p>${content.description}</p>
        </section>

        <p class="auth-onboarding-why">${content.whyItMatters}</p>

        <ol class="auth-onboarding-steps">
          <li>Connect a Nostr signer once.</li>
          <li>Approve this action when your signer asks.</li>
          <li>Use Like, Zap, and Follow across regular websites.</li>
        </ol>

        <div class="auth-onboarding-actions">
          <button type="button" class="auth-onboarding-primary">Connect Nostr</button>
          <button type="button" class="auth-onboarding-secondary">Quick setup guide</button>
          <button type="button" class="auth-onboarding-dismiss">Maybe later</button>
        </div>

        <div class="auth-onboarding-links">
          <a href="${links.quickSetupUrl}" target="_blank" rel="noopener noreferrer">Beginner setup guide</a>
          <a href="${links.signerInstallUrl}" target="_blank" rel="noopener noreferrer">Install a signer</a>
        </div>

        <div class="auth-onboarding-status" aria-live="polite"></div>
      </div>
    `;

    dialogComponent.showModal();

    const dialog = dialogComponent.getDialogElement();
    if (!dialog) {
      return { status: 'dismissed' };
    }

    const connectButton = dialog.querySelector<HTMLButtonElement>(
      '.auth-onboarding-primary'
    );
    const guideButton = dialog.querySelector<HTMLButtonElement>(
      '.auth-onboarding-secondary'
    );
    const dismissButton = dialog.querySelector<HTMLButtonElement>(
      '.auth-onboarding-dismiss'
    );
    const statusNode = dialog.querySelector<HTMLElement>(
      '.auth-onboarding-status'
    );

    const setStatus = (
      message: string,
      kind: 'neutral' | 'error' | 'success' = 'neutral'
    ) => {
      if (!statusNode) return;
      statusNode.textContent = message;
      statusNode.classList.remove('error', 'success');
      if (kind === 'error') statusNode.classList.add('error');
      if (kind === 'success') statusNode.classList.add('success');
    };

    return await new Promise<ShowAuthOnboardingResult>((resolve) => {
      let settled = false;

      const settle = (result: ShowAuthOnboardingResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      dialog.addEventListener(
        'close',
        () => {
          settle({ status: 'dismissed' });
        },
        { once: true }
      );

      guideButton?.addEventListener('click', () => {
        window.open(links.quickSetupUrl, '_blank', 'noopener,noreferrer');
        setStatus(
          'Setup guide opened in a new tab. Return here when you are ready to connect.',
          'neutral'
        );
      });

      dismissButton?.addEventListener('click', () => {
        dialogComponent.close();
        settle({ status: 'dismissed' });
      });

      connectButton?.addEventListener('click', async () => {
        connectButton.disabled = true;
        setStatus('Opening your signer connection...', 'neutral');

        const connectedPubKey = await getPublicKey();
        if (connectedPubKey) {
          setStatus('Connected. Continuing...', 'success');
          settle({ status: 'connect' });
          dialogComponent.close();
          return;
        }

        connectButton.disabled = false;
        setStatus(
          'No signer connected yet. Finish setup in the signer widget, then try Connect again.',
          'error'
        );
      });
    });
  })();

  try {
    return await activeOnboardingPromise;
  } finally {
    activeOnboardingPromise = null;
  }
}
