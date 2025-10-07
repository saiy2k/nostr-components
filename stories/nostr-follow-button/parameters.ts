// SPDX-License-Identifier: MIT

/**
 * Follow Button Parameters
 * ========================
 * 
 * This file contains parameter definitions specific to the nostr-follow-button component.
 * These parameters define follow button-specific attributes like npub, nip05, pubkey, and relays.
 */

import { USER_PARAMETERS, ParameterDefinition } from '../common/parameters';

/**
 * Follow button parameters used by nostr-follow-button component
 */
export const FOLLOW_BUTTON_PARAMETERS: ParameterDefinition[] = [
  ...USER_PARAMETERS,
];
