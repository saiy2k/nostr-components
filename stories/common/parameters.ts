// SPDX-License-Identifier: MIT

/**
 * Common Component Parameters
 * ==========================
 * 
 * This file contains shared parameter definitions that are used across multiple Nostr components.
 * These parameters define the common attributes like npub, nip05, pubkey, and relays.
 */

import { DEFAULT_RELAYS } from '../../src/common/constants';

export interface ParameterDefinition {
  variable: string;
  description: string;
  defaultValue: string;
  control: 'text' | 'boolean' | 'number' | 'color' | 'select';
}

/**
 * Common parameters shared across all Nostr components
 */
export const COMMON_PARAMETERS: ParameterDefinition[] = [
  {
    variable: 'relays',
    description: `Comma separated list of valid relays urls in the wss:// protocol\n\nCan be used to customize the list of relays`,
    defaultValue: DEFAULT_RELAYS.join(','),
    control: 'text',
  },
  {
    variable: 'data-theme',
    description: 'Theme for the component (light, dark)',
    defaultValue: '',
    control: 'text',
  },
];

/**
 * User-facing parameters shared across most Nostr components
 */
export const USER_PARAMETERS: ParameterDefinition[] = [
  {
    variable: 'npub',
    description: 'Nostr public key but in bech32 format.<br/><b>Precedence:</b> npub, nip05, pubkey',
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'nip05',
    description: 'Nostr NIP-05 URI.<br/><b>Precedence:</b> npub, nip05, pubkey',
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'pubkey',
    description: 'Raw pubkey provided by Nostr.<br/><b>Precedence:</b> npub, nip05, pubkey',
    defaultValue: 'null',
    control: 'text',
  },
  ...COMMON_PARAMETERS,
];

/**
 * Event-related parameters shared across event-based components (posts, comments, zaps, etc.)
 */
export const EVENT_PARAMETERS: ParameterDefinition[] = [
  {
    variable: 'noteid',
    description: 'Valid raw Nostr ID or valid Bech32 note ID.<br/><b>Precedence:</b> noteid, hex, eventid',
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'hex',
    description: 'Valid hex format Nostr event ID.<br/><b>Precedence:</b> noteid, hex, eventid',
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'eventid',
    description: 'Valid event ID format (nevent).<br/><b>Precedence:</b> noteid, hex, eventid',
    defaultValue: 'null',
    control: 'text',
  },
  ...COMMON_PARAMETERS,
];
