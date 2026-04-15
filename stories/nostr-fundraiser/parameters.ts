// SPDX-License-Identifier: MIT

import { EVENT_PARAMETERS, ParameterDefinition } from '../common/parameters';

export const FUNDRAISER_PARAMETERS: ParameterDefinition[] = [
  {
    variable: 'text',
    description: 'Custom label for the primary fundraiser zap button',
    defaultValue: 'Zap fundraiser',
    control: 'text',
  },
  ...EVENT_PARAMETERS,
];
