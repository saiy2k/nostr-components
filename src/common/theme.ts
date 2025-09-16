// SPDX-License-Identifier: MIT

import { Theme } from './types';
import { checkmarkIcon, nostrLogo } from './icons';

export function getNostrLogo(theme: Theme, width: number = 21, height: number = 24) {
  return nostrLogo(theme, width, height);
}

import { loadingNostrich } from './icons';

export function getLoadingNostrich(theme: Theme = 'dark'){
  return loadingNostrich(theme);
}

export function getSuccessAnimation(theme: Theme = 'dark') {
  return checkmarkIcon(theme);
}