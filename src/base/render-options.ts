// SPDX-License-Identifier: MIT

import { Theme } from "../common/types";

export interface IRenderOptions {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
}