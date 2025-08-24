import { renderCopyRow } from "./render-copy";

export function renderNip05(
  nip05: string,
): string {
  return renderCopyRow({
    value: nip05,
    display: nip05,
    monospace: true,
  });
}