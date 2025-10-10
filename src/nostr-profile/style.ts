// SPDX-License-Identifier: MIT

import { getComponentStyles } from "../common/base-styles";

export function getProfileStyles(): string {
  const customStyles = `
    /* === PROFILE CSS VARIABLES & CONTAINER PATTERN === */
    :host {
      /* Override follow button styles for profile context */
      --nostrc-follow-btn-padding: 5px 8px !important;
      --nostrc-follow-btn-font-size: 14px !important;
      --nostrc-follow-btn-border-radius: 12px !important;
      --nostrc-follow-btn-border: var(--nostrc-border-width) solid var(--nostrc-color-border) !important;
      --nostrc-follow-btn-horizontal-alignment: end !important;
      --nostrc-follow-btn-min-height: auto !important;
      --nostrc-follow-btn-width: 280px;

      /* Component theme variables (fallback to global theme tokens) */
      --nostrc-profile-bg: var(--nostrc-theme-bg, #ffffff);
      --nostrc-profile-text-primary: var(--nostrc-theme-text-primary, #333333);
      --nostrc-profile-text-secondary: var(--nostrc-theme-text-secondary, #666666);
      --nostrc-profile-border: var(--nostrc-theme-border, var(--nostrc-border-width) solid var(--nostrc-color-border));
      --nostrc-profile-banner-placeholder: var(--nostrc-profile-border);
      --nostrc-profile-font-family: var(--nostrc-font-family-primary);
      --nostrc-profile-font-size: var(--nostrc-font-size-base);
      
      /* Hover state variables */
      --nostrc-profile-hover-bg: var(--nostrc-theme-hover-bg, rgba(0, 0, 0, 0.05));
      --nostrc-profile-hover-color: var(--nostrc-theme-text-primary, #333333);
      --nostrc-profile-hover-border: var(--nostrc-theme-hover-border, var(--nostrc-border-width) solid var(--nostrc-color-border));

      /* Make the host the visual profile surface */
      display: block;
      background: var(--nostrc-profile-bg);
      color: var(--nostrc-profile-text-primary);
      border: var(--nostrc-profile-border);
      border-radius: var(--nostrc-border-radius-md);
      font-family: var(--nostrc-profile-font-family);
      font-size: var(--nostrc-profile-font-size);
      transition: background-color var(--nostrc-transition-duration) var(--nostrc-transition-timing);
    }

    .nostr-profile-container {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--nostrc-spacing-md);
      min-height: 500px;
      padding: 0px;
    }

    /* Hover state */
    :host(.is-clickable:hover) {
      background: var(--nostrc-profile-hover-bg);
      color: var(--nostrc-profile-hover-color);
      border: var(--nostrc-profile-hover-border);
    }

    .nostr-profile-top-container img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }

    .nostr-profile-bottom-container {
      min-width: 0;
      text-align: center;
    }

    .profile-banner {
      position: relative;
      width: 100%;
      height: 214px;
      cursor: pointer;
      border-radius: var(--nostrc-border-radius-md) var(--nostrc-border-radius-md) 0px 0px;
    }

    .banner-placeholder {
      width: 100%;
      height: 100%;
      background-color: var(--nostrc-profile-banner-placeholder);
      border-radius: var(--nostrc-border-radius-md) var(--nostrc-border-radius-md) 0px 0px;
    }

    .profile-banner img {
      width: 100%;
      height: 214px;
      object-fit: cover;
    }

    .dp-container {
      position: absolute;
      top: 140px;
      left: var(--nostrc-spacing-md);
    }

    .avatar {
      --avatar-size: 142px;
      --avatar-ring: 4px;

      inline-size: var(--avatar-size);
      block-size: var(--avatar-size);
      border-radius: var(--nostrc-border-radius-full);
      overflow: hidden;

      /* ring + backfill in one place */
      background-color: var(--nostrc-profile-bg);
      border: var(--avatar-ring) solid var(--nostrc-profile-bg);
    }

    .avatar img {
      inline-size: 100%;
      block-size: 100%;
      border-radius: var(--nostrc-border-radius-full);
      display: block;
      object-fit: cover;
    }

    .profile_actions {
      height: 56px;
      align-self: flex-end;
      padding: 0 var(--nostrc-spacing-lg);
    }

    .profile_data {
      padding: var(--nostrc-spacing-md);
    }

    .website {
      font-weight: 400;
      font-size: var(--nostrc-font-size-base);
      line-height: 20px;
      display: flex;
      align-items: center;
    }

    .website a {
      line-height: 20px;
      outline: none;
      color: var(--nostrc-profile-accent);
      max-width: 350px;
      overflow: hidden;
      text-overflow: ellipsis;
      word-wrap: normal;
    }

    .stats {
      position: relative;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      border-radius: 0;
      border-top: none;
      margin-top: var(--nostrc-spacing-md);
    }

    .stat {
      position: relative;
      display: inline-block;
      padding-inline: var(--nostrc-spacing-md);
      padding-block: var(--nostrc-spacing-xs);
      border: none;
      background: none;
      width: fit-content;
      height: 40px;
      margin: 0 0 var(--nostrc-spacing-md);
    }

    .stat-inner {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    .stat-inner .stat-value {
      font-weight: 100;
      font-size: 1.5em;
      color: var(--nostrc-profile-text-primary);
    }

    .stat-inner .stat-name {
      font-weight: 400;
      line-height: 16px;
      text-transform: lowercase;
      color: var(--nostrc-profile-text-secondary);
    }

    .error-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--nostrc-spacing-lg);
      min-height: 500px;
    }

    .error {
      width: 35px;
      height: 35px;
      border-radius: var(--nostrc-border-radius-full);
      background-color: var(--nostrc-color-error-text);
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--nostrc-color-background);
    }

    .error-text {
      color: var(--nostrc-color-error-text);
      font-weight: bold;
    }

    @media only screen and (max-width: 600px) {
      .stat .stat-value {
        font-size: 18px !important;
      }
      :host {
        --nostrc-follow-btn-padding: 5px 8px !important;
        --nostrc-follow-btn-font-size: 12px !important;
        --nostrc-follow-btn-min-height: auto !important;
        --nostrc-follow-btn-border-radius: 8px !important;
        --nostrc-follow-btn-error-max-width: 150px !important;
      }
    }

  `;
  
  // Use component styles - includes design tokens + utilities + custom styles
  return getComponentStyles(customStyles);
}
