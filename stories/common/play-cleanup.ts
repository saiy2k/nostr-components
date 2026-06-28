// SPDX-License-Identifier: MIT

type CleanupHost = Element & {
  __cleanup?: () => void;
};

/**
 * Registers cleanup for Storybook play functions that start timers or inject DOM.
 *
 * Storybook passes an `abortSignal` when a play run ends (e.g. navigating away).
 * This helper wires that signal to your cleanup callback and also clears any
 * previous play run via a `__cleanup` slot on the component element.
 *
 * @param component - The story's target element (used to detect play re-runs)
 * @param abortSignal - Storybook lifecycle signal; may be undefined in older setups
 * @param cleanup - Clears intervals/timeouts and removes injected UI
 * @returns The same cleanup function, for manual calls (e.g. when `isConnected` is false)
 */
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
