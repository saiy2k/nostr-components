import { httpsPictureUrl } from "./picture-url.js";
import { isVerifiedIdentity } from "./picture-backfill.js";
import { createFirestore, terminateFirestore } from "./runtime.js";

const db = await createFirestore({
  firestoreProject: "nostr-components",
  firestoreDatabase: "(default)",
});
const stats = { verified: 0, hasPicture: 0, hasXOnly: 0, missingBoth: 0 };
try {
  const snap = await db.collection("nostrDirectoryHandles").get();
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
} finally {
  await terminateFirestore(db);
  process.exit(0);
}
