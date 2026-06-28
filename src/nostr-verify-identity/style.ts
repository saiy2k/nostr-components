// SPDX-License-Identifier: MIT

import { getComponentStyles } from '../common/base-styles';

export function getVerifyIdentityStyles(): string {
  const customStyles = `
    :host {
      display: block;
      font-family: var(--nostrc-font-family-primary);
      font-size: var(--nostrc-font-size-base);
      color: var(--nostrc-theme-text-primary, #333333);
      --nc-verify-accent: var(--nostrc-color-primary, #7f00ff);
    }

    .nc-verify {
      box-sizing: border-box;
      max-width: 420px;
      padding: var(--nostrc-spacing-lg, 16px);
      background: var(--nostrc-theme-bg, #ffffff);
      border: var(--nostrc-border-width, 1px) solid var(--nostrc-color-border, #e0e0e0);
      border-radius: var(--nostrc-border-radius-md, 8px);
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-md, 12px);
    }

    .nc-verify-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nc-verify-title {
      font-weight: 600;
      font-size: var(--nostrc-font-size-lg, 1.1em);
    }

    .nc-verify-sub,
    .nc-verify-hint {
      color: var(--nostrc-theme-text-secondary, #666666);
      font-size: var(--nostrc-font-size-sm, 0.85em);
    }

    .nc-verify-text {
      margin: 0;
      line-height: 1.45;
    }

    .nc-verify-steps {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-md, 12px);
    }

    .nc-verify-steps li {
      display: flex;
      flex-direction: column;
      gap: var(--nostrc-spacing-sm, 8px);
    }

    .nc-verify-step-label {
      font-weight: 600;
      font-size: var(--nostrc-font-size-sm, 0.9em);
    }

    .nc-verify-proof {
      margin: 0;
      padding: var(--nostrc-spacing-sm, 8px) var(--nostrc-spacing-md, 12px);
      background: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.04));
      border-radius: var(--nostrc-border-radius-sm, 4px);
      font-family: var(--nostrc-font-family-mono, monospace);
      font-size: var(--nostrc-font-size-sm, 0.85em);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .nc-verify-row {
      display: flex;
      gap: var(--nostrc-spacing-sm, 8px);
      flex-wrap: wrap;
    }

    .nc-verify-input {
      width: 100%;
      box-sizing: border-box;
      padding: var(--nostrc-spacing-sm, 8px) var(--nostrc-spacing-md, 12px);
      border: var(--nostrc-border-width, 1px) solid var(--nostrc-color-border, #e0e0e0);
      border-radius: var(--nostrc-border-radius-sm, 4px);
      font: inherit;
      background: var(--nostrc-theme-bg, #ffffff);
      color: inherit;
    }

    .nc-verify-input:focus-visible {
      outline: 2px solid var(--nc-verify-accent);
      outline-offset: 1px;
    }

    .nc-verify-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--nostrc-spacing-sm, 8px);
      padding: var(--nostrc-spacing-sm, 8px) var(--nostrc-spacing-md, 14px);
      border-radius: var(--nostrc-border-radius-md, 8px);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
    }

    .nc-verify-btn[disabled] {
      pointer-events: none;
      opacity: 0.6;
    }

    .nc-verify-primary {
      background: var(--nc-verify-accent);
      color: #ffffff;
      border: var(--nostrc-border-width, 1px) solid var(--nc-verify-accent);
    }

    .nc-verify-primary:hover {
      filter: brightness(1.08);
    }

    .nc-verify-ghost {
      background: transparent;
      color: var(--nostrc-theme-text-primary, #333333);
      border: var(--nostrc-border-width, 1px) solid var(--nostrc-color-border, #e0e0e0);
    }

    .nc-verify-ghost:hover {
      background: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      border-color: var(--nc-verify-accent);
      color: var(--nc-verify-accent);
    }

    .nc-verify-npub {
      margin: 0;
      font-size: var(--nostrc-font-size-sm, 0.8em);
      color: var(--nostrc-theme-text-secondary, #666666);
    }

    code {
      font-family: var(--nostrc-font-family-mono, monospace);
      background: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.04));
      padding: 1px 5px;
      border-radius: 4px;
    }

    .nc-verify-error {
      padding: var(--nostrc-spacing-sm, 8px) var(--nostrc-spacing-md, 12px);
      border-radius: var(--nostrc-border-radius-sm, 4px);
      background: var(--nostrc-color-error-bg, #fdecea);
      color: var(--nostrc-color-error-text, #b3261e);
      font-size: var(--nostrc-font-size-sm, 0.9em);
    }

    .nc-verify-done {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--nostrc-spacing-sm, 8px);
    }

    .nc-verify-check {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--nostrc-color-success-bg, #e7f5ea);
      color: var(--nostrc-color-success-text, #1a7f37);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 700;
    }

    .nc-verify-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      display: inline-block;
      animation: nc-verify-spin 0.7s linear infinite;
    }

    @keyframes nc-verify-spin {
      to { transform: rotate(360deg); }
    }
  `;

  return getComponentStyles(customStyles);
}
