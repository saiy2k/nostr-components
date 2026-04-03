// SPDX-License-Identifier: MIT

/**
 * Onboarding dialog content styles.
 * Base dialog shell styles come from DialogComponent.
 */
export const getAuthOnboardingDialogStyles = (): string => {
  return `
    .onboarding-flow {
      display: grid;
      gap: 14px;
    }

    .onboarding-hero {
      border: 1px solid #efce77;
      border-radius: 12px;
      padding: 14px;
      background: linear-gradient(140deg, #fff6df 0%, #ffe6b3 45%, #f7cd79 100%);
      color: #3f2a00;
    }

    .nostr-base-dialog[data-theme='dark'] .onboarding-hero {
      border-color: #7a5a1b;
      background: linear-gradient(140deg, #3a2a0c 0%, #523a10 45%, #6e4b14 100%);
      color: #ffebb8;
    }

    .onboarding-hero h3 {
      margin: 0 0 6px;
      font-size: 1rem;
      line-height: 1.3;
    }

    .onboarding-hero p {
      margin: 0;
      font-size: 0.92rem;
      line-height: 1.45;
    }

    .onboarding-steps {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 6px;
      font-size: 0.9rem;
      color: var(--nostrc-theme-text-primary, #1f2937);
    }

    .onboarding-steps li {
      line-height: 1.45;
    }

    .onboarding-cta-row {
      display: grid;
      gap: 10px;
      grid-template-columns: 1fr;
    }

    .onboarding-primary-btn,
    .onboarding-secondary-btn,
    .onboarding-skip-btn,
    .onboarding-advanced-apply {
      border-radius: 10px;
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
      min-height: 40px;
      border: 1px solid transparent;
      transition: transform 0.18s ease, opacity 0.18s ease, background-color 0.18s ease, color 0.18s ease;
    }

    .onboarding-primary-btn {
      background: #d97706;
      color: #fff;
      border-color: #b45309;
    }

    .onboarding-primary-btn:hover {
      background: #b45309;
      transform: translateY(-1px);
    }

    .onboarding-secondary-btn {
      background: #0f766e;
      color: #fff;
      border-color: #115e59;
    }

    .onboarding-secondary-btn:hover {
      background: #115e59;
      transform: translateY(-1px);
    }

    .onboarding-skip-btn {
      background: transparent;
      color: var(--nostrc-theme-text-secondary, #4b5563);
      border-color: var(--nostrc-theme-border, #c7ced8);
    }

    .onboarding-skip-btn:hover {
      background: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.06));
    }

    .onboarding-primary-btn:disabled,
    .onboarding-secondary-btn:disabled,
    .onboarding-advanced-apply:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .onboarding-links {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 0.86rem;
    }

    .onboarding-links a {
      color: #0f766e;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .nostr-base-dialog[data-theme='dark'] .onboarding-links a {
      color: #5eead4;
    }

    .onboarding-advanced {
      border: 1px solid var(--nostrc-theme-border, #d1d5db);
      border-radius: 10px;
      padding: 10px;
      background: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.03));
    }

    .onboarding-advanced summary {
      cursor: pointer;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--nostrc-theme-text-primary, #111827);
    }

    .onboarding-advanced p {
      margin: 0 0 8px;
      font-size: 0.84rem;
      line-height: 1.4;
      color: var(--nostrc-theme-text-secondary, #4b5563);
    }

    .onboarding-advanced-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .onboarding-advanced-input {
      min-height: 38px;
      border-radius: 8px;
      border: 1px solid var(--nostrc-theme-border, #c7ced8);
      background: var(--nostrc-theme-bg, #fff);
      color: var(--nostrc-theme-text-primary, #111827);
      padding: 0 10px;
      font-size: 0.85rem;
    }

    .onboarding-advanced-apply {
      background: #1d4ed8;
      color: #fff;
      border-color: #1e40af;
    }

    .onboarding-advanced-apply:hover {
      background: #1e40af;
      transform: translateY(-1px);
    }

    .onboarding-status {
      min-height: 18px;
      font-size: 0.82rem;
      color: var(--nostrc-theme-text-secondary, #4b5563);
    }

    .onboarding-status.error {
      color: #b91c1c;
    }

    .onboarding-status.success {
      color: #065f46;
    }

    @media (max-width: 480px) {
      .onboarding-flow {
        gap: 12px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .onboarding-primary-btn,
      .onboarding-secondary-btn,
      .onboarding-skip-btn,
      .onboarding-advanced-apply {
        transition: none;
      }
    }
  `;
};