// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEnsureSignerForAction,
  getAuthOnboardingContent,
  getAuthOnboardingLinks,
  getSignerUnavailableMessage,
  hasConnectedSigner,
} from '../auth-onboarding';

describe('auth onboarding helpers', () => {
  it('returns action-aware onboarding copy', () => {
    const likeContent = getAuthOnboardingContent('like');
    const zapContent = getAuthOnboardingContent('zap');
    const followContent = getAuthOnboardingContent('follow');

    expect(likeContent.title).toContain('likes');
    expect(zapContent.description).toContain('Lightning');
    expect(followContent.whyItMatters).toContain('audience');
  });

  it('returns stable setup and signer install links', () => {
    expect(getAuthOnboardingLinks()).toEqual({
      quickSetupUrl: 'https://nstart.me/',
      signerInstallUrl: 'https://getalby.com/',
    });
  });

  it('returns action-aware unavailable messages', () => {
    expect(getSignerUnavailableMessage('like')).toBe(
      'Connect a Nostr signer to like this page.'
    );
    expect(getSignerUnavailableMessage('zap')).toBe(
      'Connect a Nostr signer to send a zap.'
    );
    expect(getSignerUnavailableMessage('follow')).toBe(
      'Connect a Nostr signer to follow this profile.'
    );
  });
});

describe('hasConnectedSigner', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubBrowser = (options: {
    nostr?: unknown;
    storedSession?: string | null;
    storageThrows?: boolean;
  }) => {
    vi.stubGlobal('window', {
      nostr: options.nostr,
      localStorage: {
        getItem: vi.fn((key: string) => {
          if (options.storageThrows) {
            throw new Error('storage blocked');
          }
          return key === 'wnj:bunkerPointer'
            ? (options.storedSession ?? null)
            : null;
        }),
      },
    });
  };

  it('returns false outside a browser', () => {
    expect(hasConnectedSigner()).toBe(false);
  });

  it('detects a NIP-07 extension', () => {
    stubBrowser({ nostr: { getPublicKey: () => {} } });
    expect(hasConnectedSigner()).toBe(true);
  });

  it('does not treat the window.nostr.js shim as an extension', () => {
    stubBrowser({ nostr: { isWnj: true } });
    expect(hasConnectedSigner()).toBe(false);
  });

  it('detects a stored window.nostr.js session', () => {
    stubBrowser({ nostr: { isWnj: true }, storedSession: 'nsec1example' });
    expect(hasConnectedSigner()).toBe(true);
  });

  it('returns false when storage access is blocked', () => {
    stubBrowser({ storageThrows: true });
    expect(hasConnectedSigner()).toBe(false);
  });
});

describe('createEnsureSignerForAction', () => {
  it('skips onboarding when a signer is already reachable', async () => {
    const showAuthOnboarding = vi.fn();
    const ensureSignerForAction = createEnsureSignerForAction({
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      getPublicKey: vi.fn().mockResolvedValue('pubkey-123'),
      hasConnectedSigner: vi.fn().mockReturnValue(true),
      showAuthOnboarding,
    });

    const result = await ensureSignerForAction({
      action: 'like',
      theme: 'dark',
    });

    expect(result).toEqual({
      status: 'already-connected',
      publicKey: 'pubkey-123',
    });
    expect(showAuthOnboarding).not.toHaveBeenCalled();
  });

  it('returns unavailable when a reachable signer yields no public key', async () => {
    const showAuthOnboarding = vi.fn();
    const ensureSignerForAction = createEnsureSignerForAction({
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      getPublicKey: vi.fn().mockResolvedValue(null),
      hasConnectedSigner: vi.fn().mockReturnValue(true),
      showAuthOnboarding,
    });

    const result = await ensureSignerForAction({
      action: 'like',
      theme: 'light',
    });

    expect(result).toEqual({
      status: 'unavailable',
      publicKey: null,
      message: 'Connect a Nostr signer to like this page.',
    });
    expect(showAuthOnboarding).not.toHaveBeenCalled();
  });

  it('shows onboarding before any signer call for first-time users', async () => {
    const callOrder: string[] = [];
    const ensureInitialized = vi.fn(async () => {
      callOrder.push('ensureInitialized');
    });
    const getPublicKey = vi.fn(async () => {
      callOrder.push('getPublicKey');
      return 'pubkey-connected';
    });
    const showAuthOnboarding = vi.fn(async () => {
      callOrder.push('showAuthOnboarding');
      return { status: 'connect' as const };
    });

    const ensureSignerForAction = createEnsureSignerForAction({
      ensureInitialized,
      getPublicKey,
      hasConnectedSigner: vi.fn().mockReturnValue(false),
      showAuthOnboarding,
    });

    const result = await ensureSignerForAction({
      action: 'follow',
      theme: 'dark',
    });

    expect(callOrder).toEqual([
      'showAuthOnboarding',
      'ensureInitialized',
      'getPublicKey',
    ]);
    expect(showAuthOnboarding).toHaveBeenCalledWith({
      action: 'follow',
      theme: 'dark',
    });
    expect(result).toEqual({
      status: 'connected',
      publicKey: 'pubkey-connected',
    });
  });

  it('returns dismissed without touching the signer when the user closes onboarding', async () => {
    const ensureInitialized = vi.fn();
    const getPublicKey = vi.fn();
    const ensureSignerForAction = createEnsureSignerForAction({
      ensureInitialized,
      getPublicKey,
      hasConnectedSigner: vi.fn().mockReturnValue(false),
      showAuthOnboarding: vi
        .fn()
        .mockResolvedValue({ status: 'dismissed' }),
    });

    const result = await ensureSignerForAction({
      action: 'zap',
      theme: 'light',
    });

    expect(result).toEqual({
      status: 'dismissed',
      publicKey: null,
    });
    expect(ensureInitialized).not.toHaveBeenCalled();
    expect(getPublicKey).not.toHaveBeenCalled();
  });

  it('returns unavailable when the user backs out of the signer widget', async () => {
    const ensureSignerForAction = createEnsureSignerForAction({
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      getPublicKey: vi.fn().mockResolvedValue(null),
      hasConnectedSigner: vi.fn().mockReturnValue(false),
      showAuthOnboarding: vi.fn().mockResolvedValue({ status: 'connect' }),
    });

    const result = await ensureSignerForAction({
      action: 'follow',
      theme: 'light',
    });

    expect(result).toEqual({
      status: 'unavailable',
      publicKey: null,
      message: 'Connect a Nostr signer to follow this profile.',
    });
  });

  it('returns unavailable when initialization fails after onboarding', async () => {
    const ensureSignerForAction = createEnsureSignerForAction({
      ensureInitialized: vi
        .fn()
        .mockRejectedValue(new Error('init failed')),
      getPublicKey: vi.fn(),
      hasConnectedSigner: vi.fn().mockReturnValue(false),
      showAuthOnboarding: vi.fn().mockResolvedValue({ status: 'connect' }),
    });

    const result = await ensureSignerForAction({
      action: 'zap',
      theme: 'light',
    });

    expect(result).toEqual({
      status: 'unavailable',
      publicKey: null,
      message: 'Connect a Nostr signer to send a zap.',
    });
  });
});
