import { cp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const copyRoot = join(root, "functions/nostr-atlas");

await cp(join(root, "backend/relays.json"), join(root, "functions/relays.json"));
await rm(copyRoot, { recursive: true, force: true });
await cp(join(root, "backend/nostr-atlas"), copyRoot, {
  recursive: true,
  filter: (source) => !source.endsWith("/featured-handles.js"),
});
await writeFile(
  join(copyRoot, "featured-handles.js"),
  `// SPDX-License-Identifier: MIT

export {
  FEATURED_X_HANDLES,
  listingKeyForHandle,
} from "../featured-handles.js";
`,
);
