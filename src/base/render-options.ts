import { Theme } from "../common/types";

export interface RenderOptions {
  theme: Theme;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
}