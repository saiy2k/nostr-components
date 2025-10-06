// SPDX-License-Identifier: MIT

/**
 * Profile Badge Parameters
 * ========================
 * 
 * This file contains parameter definitions specific to the nostr-profile-badge component.
 * These parameters define profile badge-specific attributes like show-npub and show-follow.
 */

import { USER_PARAMETERS, ParameterDefinition } from '../common/parameters';

/**
 * Profile badge-specific parameters
 */
export const PROFILE_BADGE_PARAMETERS: ParameterDefinition[] = [
  ...USER_PARAMETERS,
  {
    variable: 'show-npub',
    description: `Whether need to show the npub in the profile badge or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
  {
    variable: 'show-follow',
    description: `Whether need to show the follow button in the profile badge or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
];