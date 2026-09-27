// SPDX-License-Identifier: MIT

// Browse order for the unfiltered directory. Slots 0–49 fill the first five
// pages at the default size of 10. Every other handle sorts after these.
export const FEATURED_X_HANDLES = [
  "jack",
  "lynaldencontact",
  "lopp",
  "excellion",
  "gladstein",
  "odell",
  "jespow",
  "wongmjane",
  "dergigi",
  "hodlonaut",
  "btcsessions",
  "_checkmatey_",
  "giacomozucco",
  "therationalroot",
  "chartsbtc",
  "niw",
  "dries",
  "marttimalmi",
  "lorenb",
  "mg",
  "pavolrusnak",
  "milessuter",
  "brockm",
  "rabble",
  "joenakamoto",
  "princeysov",
  "hillebrandmax",
  "dilutionproof",
  "sethforprivacy",
  "benthecarman",
  "derekmross",
  "fiatjaf",
  "insomporamin",
  "miladnu",
  "lunaticoin",
  "cryptovizart",
  "mrhodl",
  "bslagter",
  "adriancantrill",
  "mattn_jp",
  "skwp",
  "bigmarh",
  "openoms",
  "mrkukks",
  "realmuster",
  "pirateorg",
  "decodejar",
  "waynevaughan",
  "agektmr",
  "donmcallister",
];

const FEATURED_INDEX = new Map(
  FEATURED_X_HANDLES.map((handle, index) => [handle, index]),
);

export function listingKeyForHandle(handle) {
  const normalized = String(handle || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  const index = FEATURED_INDEX.get(normalized);
  if (index !== undefined) return `0-${String(index).padStart(4, "0")}`;
  return `1-twitter:${normalized}`;
}
