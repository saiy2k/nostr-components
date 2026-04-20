// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest';
import {
  createEnsureSignerForAction,
  getAuthOnboardingContent,
  getAuthOnboardingLinks,
  getSignerUnavailableMessage,
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

describe('createEnsureSignerForAction', () => {
  it('skips onboarding when the signer is already connected', async () => {
    const showAuthOnboarding = vi.fn();
    const ensureSignerForAction = createEnsureSignerForAction({
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      getPublicKey: vi.fn().mockResolvedValue('pubkey-123'),
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

  it('returns dismissed when the user closes onboarding', async () => {
    const ensureSignerForAction = createEnsureSignerForAction({
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      getPublicKey: vi.fn().mockResolvedValue(null),
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
  });

  it('returns connected after onboarding succeeds', async () => {
    const getPublicKey = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('pubkey-connected');
    const showAuthOnboarding = vi
      .fn()
      .mockResolvedValue({ status: 'connect' });

    const ensureSignerForAction = createEnsureSignerForAction({
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      getPublicKey,
      showAuthOnboarding,
    });

    const result = await ensureSignerForAction({
      action: 'follow',
      theme: 'dark',
    });

    expect(showAuthOnboarding).toHaveBeenCalledWith({
      action: 'follow',
      theme: 'dark',
    });
    expect(result).toEqual({
      status: 'connected',
      publicKey: 'pubkey-connected',
    });
  });

  it('returns unavailable when initialization fails', async () => {
    const ensureSignerForAction = createEnsureSignerForAction({
      ensureInitialized: vi
        .fn()
        .mockRejectedValue(new Error('init failed')),
      getPublicKey: vi.fn(),
      showAuthOnboarding: vi.fn(),
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
