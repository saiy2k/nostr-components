// SPDX-License-Identifier: MIT

/**
 * Livestream Parameters
 * =====================
 * 
 * This file contains parameter definitions specific to the nostr-livestream component.
 * These parameters define livestream-specific attributes like naddr and livestream-specific features.
 */

import { ParameterDefinition, COMMON_PARAMETERS } from '../common/parameters';

/**
 * Livestream-specific parameters used by nostr-livestream component
 */
export const LIVESTREAM_PARAMETERS: ParameterDefinition[] = [
  {
    variable: 'naddr',
    description: 'NIP-19 addressable event code for the livestream (bech32-encoded naddr)',
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'show-participants',
    description: 'Display participant list',
    defaultValue: 'true',
    control: 'boolean',
  },
  {
    variable: 'show-participant-count',
    description: 'Display current/total participant counts',
    defaultValue: 'true',
    control: 'boolean',
  },
  {
    variable: 'auto-play',
    description: 'Autoplay video when status is "live"',
    defaultValue: 'false',
    control: 'boolean',
  },
  ...COMMON_PARAMETERS,
];
