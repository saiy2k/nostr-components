// SPDX-License-Identifier: MIT

type CleanupHost = Element & {
  __cleanup?: () => void;
};

export function registerStoryCleanup(
  component: Element,
  abortSignal: AbortSignal | undefined,
  cleanup: () => void
): () => void {
  const host = component as CleanupHost;
  let cleaned = false;

  const runCleanup = () => {
    if (cleaned) return;

    cleaned = true;
    cleanup();

    if (host.__cleanup === runCleanup) {
      delete host.__cleanup;
    }

    abortSignal?.removeEventListener('abort', runCleanup);
  };

  host.__cleanup?.();
  host.__cleanup = runCleanup;

  if (abortSignal) {
    if (abortSignal.aborted) {
      runCleanup();
    } else {
      abortSignal.addEventListener('abort', runCleanup, { once: true });
    }
  }

  return runCleanup;
}
