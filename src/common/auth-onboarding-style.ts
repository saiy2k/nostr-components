// SPDX-License-Identifier: MIT

/**
 * Onboarding dialog content styles.
 * The shared dialog shell comes from DialogComponent.
 */
export function getAuthOnboardingDialogStyles(): string {
  return `
    .auth-onboarding {
      display: grid;
      gap: 14px;
    }

    .auth-onboarding-hero {
      display: grid;
      gap: 8px;
      padding: 14px;
      border-radius: 14px;
      border: 1px solid #f1c35b;
      background: linear-gradient(145deg, #fff8df 0%, #ffeab9 55%, #ffd978 100%);
      color: #503100;
    }

    .nostr-base-dialog[data-theme='dark'] .auth-onboarding-hero {
      border-color: #7d5b13;
      background: linear-gradient(145deg, #3f2d08 0%, #5a410d 55%, #765515 100%);
      color: #ffecb8;
    }

    .auth-onboarding-eyebrow {
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .auth-onboarding-hero h3 {
      margin: 0;
      font-size: 1rem;
      line-height: 1.35;
    }

    .auth-onboarding-hero p,
    .auth-onboarding-why {
      margin: 0;
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .auth-onboarding-why {
      color: var(--nostrc-theme-text-secondary, #4b5563);
    }

    .auth-onboarding-steps {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 6px;
      color: var(--nostrc-theme-text-primary, #111827);
      font-size: 0.9rem;
    }

    .auth-onboarding-steps li {
      line-height: 1.45;
    }

    .auth-onboarding-actions {
      display: grid;
      gap: 10px;
    }

    .auth-onboarding-primary,
    .auth-onboarding-secondary,
    .auth-onboarding-dismiss {
      min-height: 42px;
      border-radius: 10px;
      border: 1px solid transparent;
      font: inherit;
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
      transition:
        transform 0.18s ease,
        background-color 0.18s ease,
        color 0.18s ease,
        border-color 0.18s ease,
        opacity 0.18s ease;
    }

    .auth-onboarding-primary {
      background: #d97706;
      color: #ffffff;
      border-color: #b45309;
    }

    .auth-onboarding-primary:hover:not(:disabled) {
      background: #b45309;
      transform: translateY(-1px);
    }

    .auth-onboarding-secondary {
      background: #0f766e;
      color: #ffffff;
      border-color: #115e59;
    }

    .auth-onboarding-secondary:hover:not(:disabled) {
      background: #115e59;
      transform: translateY(-1px);
    }

    .auth-onboarding-dismiss {
      background: transparent;
      color: var(--nostrc-theme-text-secondary, #4b5563);
      border-color: var(--nostrc-theme-border, #d1d5db);
    }

    .auth-onboarding-dismiss:hover:not(:disabled) {
      background: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
    }

    .auth-onboarding-primary:disabled,
    .auth-onboarding-secondary:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      transform: none;
    }

    .auth-onboarding-links {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 0.86rem;
    }

    .auth-onboarding-links a {
      color: #0f766e;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .nostr-base-dialog[data-theme='dark'] .auth-onboarding-links a {
      color: #5eead4;
    }

    .auth-onboarding-status {
      min-height: 18px;
      color: var(--nostrc-theme-text-secondary, #4b5563);
      font-size: 0.83rem;
    }

    .auth-onboarding-status.error {
      color: #b91c1c;
    }

    .auth-onboarding-status.success {
      color: #047857;
    }

    @media (prefers-reduced-motion: reduce) {
      .auth-onboarding-primary,
      .auth-onboarding-secondary,
      .auth-onboarding-dismiss {
        transition: none;
      }
    }
  `;
}
