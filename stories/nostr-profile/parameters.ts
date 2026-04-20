// SPDX-License-Identifier: MIT

/**
 * Profile Parameters
 * ==================
 * 
 * This file contains parameter definitions specific to profile-related components.
 * These parameters define profile-specific attributes like show-npub and show-follow.
 */

import { USER_PARAMETERS, ParameterDefinition } from '../common/parameters';

/**
 * Profile-specific parameters used by nostr-profile component
 */
export const PROFILE_PARAMETERS: ParameterDefinition[] = [
  ...USER_PARAMETERS,
  {
    variable: 'show-npub',
    description: 'Show the npub in the profile',
    defaultValue: 'false',
    control: 'boolean',
  },
  {
    variable: 'show-follow',
    description: 'Show the follow button in the profile',
    defaultValue: 'false',
    control: 'boolean',
  },
];
