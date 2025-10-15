// SPDX-License-Identifier: MIT

/**
 * Zap Button Parameters
 * ====================
 * 
 * This file contains parameter definitions specific to the nostr-zap component.
 * These parameters define zap button-specific attributes like npub, nip05, pubkey, relays, and zap-specific options.
 */

import { USER_PARAMETERS, ParameterDefinition } from '../common/parameters';

/**
 * Zap button parameters used by nostr-zap component
 */
export const ZAP_BUTTON_PARAMETERS: ParameterDefinition[] = [
  ...USER_PARAMETERS,
  {
    variable: 'text',
    description: 'Custom text to display on the zap button',
    defaultValue: 'Zap',
    control: 'text',
  },
  {
    variable: 'amount',
    description: 'Pre-defined zap amount in sats (fixed amount, no dialog)',
    defaultValue: '',
    control: 'number',
  },
  {
    variable: 'default-amount',
    description: 'Default zap amount in sats (shown in dialog)',
    defaultValue: '1000',
    control: 'number',
  },
];
