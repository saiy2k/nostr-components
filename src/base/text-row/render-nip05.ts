// SPDX-License-Identifier: MIT

import { renderTextRow } from "./render-text-row";

export function renderNip05(
  nip05: string,
): string {
  return renderTextRow({
    value: nip05,
    display: nip05,
    monospace: true,
    showCopyButton: true,
  });
}