import { renderCopyRow } from "./render-copy";
import { maskNPub } from "../common/utils";

export function renderNpub(
  npub: string,
): string {

  return renderCopyRow({
    value: npub,
    display: maskNPub(npub),
    monospace: true,
  });
}