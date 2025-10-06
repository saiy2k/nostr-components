// SPDX-License-Identifier: MIT

/**
 * Post Parameters
 * ===============
 * 
 * This file contains parameter definitions specific to the nostr-post component.
 * These parameters define post-specific attributes like noteid, hex, eventid, and post-specific features.
 */

import { EVENT_PARAMETERS, ParameterDefinition } from '../common/parameters';

/**
 * Post-specific parameters used by nostr-post component
 */
export const POST_PARAMETERS: ParameterDefinition[] = [
  ...EVENT_PARAMETERS,
  {
    variable: 'show-stats',
    description: `Whether need to show the stats of the post or not`,
    defaultValue: 'false',
    control: 'boolean',
  },
  {
    variable: 'onClick',
    description: `Function name to call when post is clicked`,
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'onAuthorClick',
    description: `Function name to call when author is clicked`,
    defaultValue: 'null',
    control: 'text',
  },
  {
    variable: 'onMentionClick',
    description: `Function name to call when mention is clicked`,
    defaultValue: 'null',
    control: 'text',
  },
];
