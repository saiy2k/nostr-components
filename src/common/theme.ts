// SPDX-License-Identifier: MIT

import { Theme } from './types';
import { checkmarkIcon, nostrLogo } from './icons';

export function getNostrLogo(width: number = 21, height: number = 24) {
  return nostrLogo(width, height);
}

import { loadingNostrich } from './icons';

export function getLoadingNostrich(){
  return loadingNostrich();
}

export function getSuccessAnimation(theme: Theme = 'dark') {
  return checkmarkIcon(theme);
}