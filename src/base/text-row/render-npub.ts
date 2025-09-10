// SPDX-License-Identifier: MIT

import { renderTextRow } from "./render-text-row";
import { maskNPub } from "../../common/utils";

export function renderNpub(
  npub: string,
): string {

  return renderTextRow({
    value: npub,
    display: maskNPub(npub),
    monospace: true,
    showCopyButton: true,
  });
}