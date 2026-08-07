// SPDX-License-Identifier: MIT

const DIRECTORY_LOOKUP_ENDPOINT =
  "https://us-central1-gr-prod.cloudfunctions.net/lookupDirectoryHandle";
const LOOKUP_TIMEOUT_MS = 5000;

/** Normalize and validate a public X handle before it reaches the backend. */
function normalizeHandle(value) {
  const handle = String(value || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
}

/** Query the read-only Firestore directory function with a bounded timeout. */
async function lookupDirectoryHandle(message) {
  const handle = normalizeHandle(message.handle);
  if (!handle) {
    throw new Error("Invalid X handle");
  }

  const url = new URL(DIRECTORY_LOOKUP_ENDPOINT);
  url.searchParams.set("platform", "twitter");
  url.searchParams.set("handle", handle);

  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    const result = await response.json();
    if (response.status === 404 && result && result.found === false) {
      return result;
    }
    if (!response.ok) {
      throw new Error("Directory lookup failed with status " + response.status);
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (!message || message.type !== "LOOKUP_DIRECTORY_HANDLE") {
    return false;
  }

  lookupDirectoryHandle(message).then(
    function (result) {
      sendResponse({ ok: true, result: result });
    },
    function (error) {
      sendResponse({
        ok: false,
        error:
          error instanceof Error ? error.message : "Directory lookup failed",
      });
    },
  );

  return true;
});
