import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const copyRoot = join(root, "functions/relay-directory");

await cp(join(root, "backend/relays.json"), join(root, "functions/relays.json"));
await rm(copyRoot, { recursive: true, force: true });
await cp(join(root, "backend/relay-directory"), copyRoot, { recursive: true });

const projection = join(copyRoot, "projection-state.js");
const source = await readFile(projection, "utf8");
await writeFile(
  projection,
  source.replace(
    "../../functions/featured-handles.js",
    "../featured-handles.js",
  ),
);
