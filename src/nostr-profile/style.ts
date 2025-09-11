// SPDX-License-Identifier: MIT

import { Theme } from "../common/types";
import { getComponentStyles } from "../common/base-styles";

export function getProfileStyles(theme: Theme): string {
  const customStyles = `
    /* === PROFILE CONTAINER PATTERN === */
    :host {
      /* Override follow button styles for profile context */
      --nostrc-follow-btn-padding: 5px 8px !important;
      --nostrc-follow-btn-font-size: 14px !important;
      --nostrc-follow-btn-border-radius: 12px !important;
      --nostrc-follow-btn-border-dark: 1px solid #DDDDDD !important;
      --nostrc-follow-btn-border-light: 1px solid #DDDDDD !important;
      --nostrc-follow-btn-horizontal-alignment: end !important;
      --nostrc-follow-btn-min-height: auto !important;
      --nostrc-follow-btn-width: 280px;
    }

    .nostr-profile-container {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--nostrc-spacing-md);

      min-height: 500px;
      padding: 0px;
    }
    
    :host(.is-clickable) .nostrc-container {
      cursor: auto;
    }
    
    :host(.is-clickable) .nostrc-container:hover {
      background-color: var(--nostrc-color-background);
    }

    :host(.is-error) .nostrc-container {
      justify-content: center;
      align-items: center;
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
      background-color: var(--nostrc-color-background);
      border: var(--avatar-ring) solid var(--nostrc-color-background);
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
      color: var(--nostrc-color-accent);
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
      background-color: var(--nostrc-color-background);
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
      color: var(--nostrc-color-text-primary);
    }

    .stat-inner .stat-name {
      font-weight: 400;
      line-height: 16px;
      color: var(--nostrc-color-text-secondary);
      text-transform: lowercase;
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
  return getComponentStyles(theme, customStyles);
}
