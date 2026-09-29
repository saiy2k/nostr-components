import { httpsPictureUrl } from "./picture-url.js";
import { isVerifiedIdentity } from "./picture-backfill.js";
import { createFirestore, terminateFirestore } from "./runtime.js";

function optionValue(argv, index, flag) {
  const value = argv[index + 1];
  if (typeof value !== "string" || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    project: process.env.FIRESTORE_PROJECT || "nostr-components",
    database: process.env.FIRESTORE_DATABASE || "(default)",
    collection:
      process.env.FIRESTORE_HANDLES_COLLECTION || "nostrDirectoryHandles",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      options.project = optionValue(argv, index, arg);
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const db = await createFirestore({
  firestoreProject: options.project,
  firestoreDatabase: options.database,
});
const stats = { verified: 0, hasPicture: 0, hasXOnly: 0, missingBoth: 0 };
try {
  const snap = await db.collection(options.collection).get();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (!isVerifiedIdentity(data.activeIdentity)) continue;
    stats.verified += 1;
    const metadata = data.activeIdentity.metadata || {};
    if (httpsPictureUrl(metadata.picture)) stats.hasPicture += 1;
    else if (httpsPictureUrl(metadata.xPicture)) stats.hasXOnly += 1;
    else stats.missingBoth += 1;
  }
  console.log(JSON.stringify(stats));
} catch (error) {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
} finally {
  if (db) await terminateFirestore(db);
}
