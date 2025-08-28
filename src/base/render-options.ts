import { Theme } from "../common/types";

export interface IRenderOptions {
  theme: Theme;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
}