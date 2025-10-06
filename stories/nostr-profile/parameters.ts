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
    description: `Whether need to show the npub in the profile or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
  {
    variable: 'show-follow',
    description: `Whether need to show the follow button in the profile or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
];