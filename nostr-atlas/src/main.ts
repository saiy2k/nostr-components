import "./styles.css";
import {
  type DirectoryCategory,
  type DirectoryProfile,
} from "./data";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  getPaginationPageList,
  getRequiredBatchOffsets,
  getVisibleProfiles,
  paginateProfiles,
  profileAvatarHtml,
  truncateNpub,
  type DirectorySort,
} from "./directory";
import { icon } from "./icons";
import {
  DEFAULT_ATLAS_API_URL,
  DIRECTORY_BATCH_SIZE,
  fetchDirectoryPageAtOffset,
  type DirectoryPage,
} from "./api";
import {
  homeDocumentSeo,
  nip05ProfileUrl,
  siteOriginFrom,
  xProfileUrl,
} from "./seo";
import {
  applyDocumentSeo,
  configureSiteActions,
  escapeHtml,
  showToast,
} from "./site";
import {
  claimProofComposerUrl,
  connectClaimSigner,
  type NostrSigner,
} from "./claim";
import {
  CLAIM_COPY,
  claimDialogAfterClose,
  submitXClaim,
  type ClaimStatusState,
} from "./claim-flow";

const directoryApiUrl =
  import.meta.env.VITE_ATLAS_API_URL?.trim() || DEFAULT_ATLAS_API_URL;
const siteOrigin = siteOriginFrom(import.meta.env.VITE_SITE_ORIGIN);
let profileBatches = new Map<number, DirectoryProfile[]>();
let batchNextCursors = new Map<number, string | null>();
let previewProfiles: DirectoryProfile[] = [];
let claimIdentity: { pubkey: string; npub: string } | null = null;
let totalProfiles = 0;
let directoryTotal = 0;
let loading = false;
let loaded = false;
let loadFailed = false;
let loadGeneration = 0;
let pendingLoads = 0;
let category: DirectoryCategory = "Popular on X.com";
let query = "";
const sort: DirectorySort = "followers";
let currentPage = 1;
let pageSize = DEFAULT_PAGE_SIZE;
let searchTimer: number | null = null;

function profileRow(profile: DirectoryProfile): string {
  const safeName = escapeHtml(profile.name);
  const safeHandle = escapeHtml(profile.handle);
  const safeNip05 = escapeHtml(profile.nip05);
  const safeNpub = escapeHtml(profile.npub);
  const nip05Url = nip05ProfileUrl(profile.nip05);
  const handleUrl = xProfileUrl(profile.handle);
  const handleHtml = handleUrl
    ? `<a href="${escapeHtml(handleUrl)}" target="_blank" rel="noreferrer" title="Open X profile">${safeHandle}</a>`
    : safeHandle;
  const verificationLabel = profile.verified
    ? "X account ownership verified"
    : "Local preview · not verified";

  return `
    <article class="profile-row" data-profile-id="${escapeHtml(profile.id)}">
      <div class="profile-primary">
        ${profileAvatarHtml(profile)}
        <span class="profile-name-wrap">
          <span class="profile-name-line">
            <strong>${safeName}</strong>
            ${profile.verified ? `<span class="verified-mark" title="${verificationLabel}">${icon.check()}<span class="sr-only">${verificationLabel}</span></span>` : ""}
          </span>
          <span class="profile-handle">${handleHtml}${profile.verified ? "" : " · Local preview"}</span>
        </span>
      </div>
      ${nip05Url ? `<a class="nip05-link" href="${escapeHtml(nip05Url)}" target="_blank" rel="noreferrer" title="Profile-provided Nostr address">${safeNip05}</a>` : `<span class="nip05-link">${safeNip05 || "—"}</span>`}
      <button class="npub-copy" type="button" data-copy-npub="${safeNpub}" aria-label="Copy Nostr public key for ${safeName}">
        <span>${escapeHtml(truncateNpub(profile.npub))}</span>
        ${icon.copy()}
      </button>
      <a class="profile-link" href="https://njump.me/${safeNpub}" target="_blank" rel="noreferrer">
        <span>Open Nostr profile</span>${icon.external()}
      </a>
    </article>`;
}

function matchingPreviewProfiles(): DirectoryProfile[] {
  return getVisibleProfiles(previewProfiles, { category, query, sort });
}

function cachedRemoteProfile(index: number): DirectoryProfile | undefined {
  const batchOffset =
    Math.floor(index / DIRECTORY_BATCH_SIZE) * DIRECTORY_BATCH_SIZE;
  return profileBatches.get(batchOffset)?.[index - batchOffset];
}

function currentDirectoryPage() {
  const previews = matchingPreviewProfiles();
  const remoteTotal = totalProfiles;
  const totalItems = previews.length + remoteTotal;
  const pagination = paginateProfiles(
    Array.from({ length: totalItems }, (_, index) => index),
    currentPage,
    pageSize,
  );
  const items = pagination.items
    .map((index) =>
      index < previews.length
        ? previews[index]
        : cachedRemoteProfile(index - previews.length),
    )
    .filter((profile): profile is DirectoryProfile => profile !== undefined);

  return { pagination, items, previewCount: previews.length };
}

function requiredBatchOffsets(): number[] {
  if (totalProfiles === 0) return [];
  const { pagination, previewCount } = currentDirectoryPage();
  return getRequiredBatchOffsets(
    pagination.startIndex,
    pagination.endIndex,
    previewCount,
    totalProfiles,
    DIRECTORY_BATCH_SIZE,
    new Set(profileBatches.keys()),
  );
}

function renderProfiles(): void {
  const results = document.querySelector<HTMLDivElement>("#profile-results");
  const resultCount = document.querySelector<HTMLElement>("#result-count");
  if (!results || !resultCount) return;

  const { pagination, items } = currentDirectoryPage();
  currentPage = pagination.page;

  if (loading && !loaded) {
    resultCount.textContent = "Loading verified accounts…";
  } else if (pagination.totalItems === 0) {
    resultCount.textContent = "0 verified accounts";
  } else {
    const accountNoun =
      pagination.totalItems === 1 ? "verified account" : "verified accounts";
    resultCount.textContent = `Showing ${pagination.startIndex + 1}–${pagination.endIndex} of ${pagination.totalItems} ${accountNoun}`;
  }

  results.setAttribute("aria-busy", String(loading));
  const waitingForPage = loading && items.length === 0;
  const missingPage = pagination.totalItems > 0 && items.length === 0;
  const emptyTitle = waitingForPage
    ? "Loading verified accounts…"
    : loadFailed && (!loaded || missingPage)
      ? "This directory page could not be loaded"
      : "No verified accounts found";
  const emptyDescription = waitingForPage
    ? "Fetching verified accounts."
    : loadFailed && (!loaded || missingPage)
      ? "Reload the page to try again."
      : "Try an X handle, NIP-05 address, or npub. A partial handle lists every match.";

  results.innerHTML = items.length
    ? items.map(profileRow).join("")
    : `
      <div class="empty-state">
        <span>${icon.search()}</span>
        <h3>${emptyTitle}</h3>
        <p>${emptyDescription}</p>
        <button class="text-button" type="button" id="clear-filters">Clear search and filters</button>
      </div>`;

  renderPagination(pagination);
  renderDirectoryStatus();
}

function renderPagination(
  pagination: ReturnType<typeof paginateProfiles<number>>,
): void {
  const paginationNav = document.querySelector<HTMLElement>(
    "#directory-pagination",
  );
  if (!paginationNav) return;

  if (pagination.totalItems === 0 || (!loaded && loading)) {
    paginationNav.hidden = true;
    paginationNav.innerHTML = "";
    return;
  }

  paginationNav.hidden = false;
  const pageList = getPaginationPageList(
    pagination.page,
    pagination.totalPages,
  );

  const pagesHtml = pageList
    .map((item) => {
      if (item === "…") {
        return `<span class="pagination-ellipsis" aria-hidden="true">…</span>`;
      }
      const isCurrent = item === pagination.page;
      return `
        <button
          class="pagination-page-btn${isCurrent ? " active" : ""}"
          type="button"
          data-page="${item}"
          aria-label="Page ${item}"
          ${isCurrent ? 'aria-current="page"' : ""}
        >${item}</button>`;
    })
    .join("");

  const startNumber = pagination.startIndex + 1;
  const endNumber = pagination.endIndex;

  paginationNav.innerHTML = `
    <div class="pagination-summary">
      Showing <strong>${startNumber}–${endNumber}</strong> of <strong>${pagination.totalItems}</strong> accounts
    </div>
    <div class="pagination-controls">
      <button
        class="pagination-nav-btn"
        id="pagination-prev"
        type="button"
        aria-label="Previous page"
        ${pagination.page <= 1 ? "disabled" : ""}
      >
        ${icon.chevronLeft()}<span>Previous</span>
      </button>
      <div class="pagination-pages" role="group" aria-label="Pagination pages">
        ${pagesHtml}
      </div>
      <button
        class="pagination-nav-btn"
        id="pagination-next"
        type="button"
        aria-label="Next page"
        ${pagination.page >= pagination.totalPages ? "disabled" : ""}
      >
        <span>Next</span>${icon.chevronRight()}
      </button>
    </div>
    <div class="pagination-size">
      <label for="page-size-select" class="sr-only">Accounts per page</label>
      <div class="page-size-wrap">
        <select id="page-size-select" aria-label="Accounts per page">
          ${PAGE_SIZE_OPTIONS.map(
            (opt) =>
              `<option value="${opt}"${pageSize === opt ? " selected" : ""}>${opt} per page</option>`,
          ).join("")}
        </select>
        ${icon.chevron()}
      </div>
    </div>`;
}

function renderDirectoryStatus(): void {
  const status = document.querySelector<HTMLElement>("#directory-status");
  const cachedProfiles = [...profileBatches.values()].reduce(
    (count, batch) => count + batch.length,
    0,
  );
  if (!status) return;
  const accountLabel = (count: number) =>
    `verified X ${count === 1 ? "account" : "accounts"}`;
  status.textContent = loadFailed
    ? "Could not load verified accounts. Check your connection and reload the page. Local previews are kept."
    : loading
      ? "Loading verified accounts…"
      : query
        ? `${totalProfiles} ${accountLabel(totalProfiles)} match this search; ${cachedProfiles} cached in this browser.`
        : `${directoryTotal} ${accountLabel(directoryTotal)} in the directory; ${cachedProfiles} cached in this browser.`;
}

async function loadProfileBatches(
  offsets: readonly number[],
  reset = false,
): Promise<void> {
  const generation = reset ? loadGeneration + 1 : loadGeneration;
  if (reset) {
    loadGeneration = generation;
    pendingLoads = 0;
  }
  if (offsets.length === 0) {
    loadFailed = false;
    renderProfiles();
    return;
  }

  pendingLoads += 1;
  loading = true;
  loadFailed = false;
  renderProfiles();
  try {
    const pages: DirectoryPage[] = [];
    const workingCursors = reset ? new Map() : new Map(batchNextCursors);
    for (const offset of [...offsets].sort((a, b) => a - b)) {
      await fetchDirectoryPageAtOffset(
        directoryApiUrl,
        { offset, search: query, cachedCursors: workingCursors },
        (page) => {
          pages.push(page);
          workingCursors.set(page.offset, page.nextCursor);
        },
      );
    }
    if (generation !== loadGeneration) return;

    if (reset) {
      profileBatches = new Map();
      batchNextCursors = new Map();
    }
    for (const page of pages) {
      profileBatches.set(page.offset, page.profiles);
      batchNextCursors.set(page.offset, page.nextCursor);
    }
    totalProfiles = pages[0]?.total ?? 0;
    if (!query) directoryTotal = totalProfiles;
    loaded = true;
  } catch (error) {
    if (generation !== loadGeneration) return;
    loadFailed = true;
    console.error("Failed to load the creator directory", error);
  } finally {
    if (generation === loadGeneration) {
      pendingLoads = Math.max(0, pendingLoads - 1);
      loading = pendingLoads > 0;
      renderProfiles();
    }
  }
}

async function reloadProfiles(search = query): Promise<void> {
  const nextQuery = search.trim();
  const previousQuery = query;
  query = nextQuery;
  await loadProfileBatches([0], true);
  if (loadFailed && query === nextQuery) {
    if (!loaded) {
      syncSearchUrl(query);
      return;
    }
    query = previousQuery;
    const searchInput = document.querySelector<HTMLInputElement>(
      "#directory-search",
    );
    if (searchInput && searchInput.value.trim() === nextQuery) {
      searchInput.value = previousQuery;
    }
    renderProfiles();
    syncSearchUrl(query);
    return;
  }
  if (!loadFailed) currentPage = 1;
  syncSearchUrl(query);
}

async function ensureCurrentPageLoaded(): Promise<void> {
  await loadProfileBatches(requiredBatchOffsets());
}

function readSearchQuery(): string {
  return new URLSearchParams(location.search).get("q") ?? "";
}

function syncSearchUrl(value: string): void {
  const url = new URL(location.href);
  const trimmed = value.trim();
  if (trimmed) url.searchParams.set("q", trimmed);
  else url.searchParams.delete("q");
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${location.pathname}${location.search}${location.hash}`;
  if (next !== current) history.replaceState(null, "", next);
}

function boot(): void {
  configureSiteActions(siteOrigin);
  bindEvents();
  const initialQuery = readSearchQuery();
  const searchInput = document.querySelector<HTMLInputElement>("#directory-search");
  if (searchInput) searchInput.value = initialQuery;
  applyDocumentSeo(homeDocumentSeo(siteOrigin));
  void reloadProfiles(initialQuery);
}

function scrollToDirectory(): void {
  const directorySection = document.querySelector("#directory");
  if (directorySection) {
    const rect = directorySection.getBoundingClientRect();
    if (rect.top < 0) {
      directorySection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

function bindEvents(): void {
  const paginationNav = document.querySelector("#directory-pagination");
  paginationNav?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const pageBtn = target.closest<HTMLButtonElement>("[data-page]");
    if (pageBtn?.dataset.page) {
      const newPage = parseInt(pageBtn.dataset.page, 10);
      if (!isNaN(newPage) && newPage !== currentPage) {
        currentPage = newPage;
        renderProfiles();
        void ensureCurrentPageLoaded();
        scrollToDirectory();
      }
      return;
    }

    const prevBtn = target.closest<HTMLButtonElement>("#pagination-prev");
    if (prevBtn && currentPage > 1) {
      currentPage--;
      renderProfiles();
      void ensureCurrentPageLoaded();
      scrollToDirectory();
      return;
    }

    const nextBtn = target.closest<HTMLButtonElement>("#pagination-next");
    if (nextBtn) {
      const { totalPages } = currentDirectoryPage().pagination;
      if (currentPage < totalPages) {
        currentPage++;
        renderProfiles();
        void ensureCurrentPageLoaded();
        scrollToDirectory();
      }
    }
  });

  paginationNav?.addEventListener("change", (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>(
      "#page-size-select",
    );
    if (!select) return;
    const newSize = parseInt(select.value, 10);
    if (!isNaN(newSize) && newSize > 0) {
      pageSize = newSize;
      currentPage = 1;
      renderProfiles();
      void ensureCurrentPageLoaded();
      scrollToDirectory();
    }
  });

  const searchForm = document.querySelector<HTMLFormElement>("#hero-search");
  const searchInput =
    document.querySelector<HTMLInputElement>("#directory-search");
  const profileDialog =
    document.querySelector<HTMLDialogElement>("#profile-dialog");
  const claimForm = document.querySelector<HTMLFormElement>(
    "#claim-account-form",
  );
  const connectClaimButton = document.querySelector<HTMLButtonElement>(
    "#connect-claim-signer",
  );
  const claimNpub = document.querySelector<HTMLElement>("#claim-npub");
  const copyClaimNpub =
    document.querySelector<HTMLButtonElement>("#copy-claim-npub");
  const claimProofLink =
    document.querySelector<HTMLAnchorElement>("#claim-proof-link");
  const publishClaimButton =
    document.querySelector<HTMLButtonElement>("#publish-claim");
  const claimStatus = document.querySelector<HTMLElement>("#claim-status");
  let publishing = false;

  const setClaimStatus = (
    message: string,
    state: "idle" | "working" | "error" | "success" = "idle",
  ) => {
    if (!claimStatus) return;
    claimStatus.textContent = message;
    claimStatus.dataset.state = state;
  };

  const clearClaimIdentity = () => {
    claimIdentity = null;
    if (claimNpub) claimNpub.textContent = "Not connected";
    if (copyClaimNpub) copyClaimNpub.disabled = true;
    if (publishClaimButton) publishClaimButton.disabled = true;
    if (claimProofLink) {
      claimProofLink.removeAttribute("href");
      claimProofLink.removeAttribute("target");
      claimProofLink.removeAttribute("rel");
      claimProofLink.setAttribute("aria-disabled", "true");
    }
  };

  const showClaimIdentity = (identity: { pubkey: string; npub: string }) => {
    claimIdentity = identity;
    if (claimNpub) claimNpub.textContent = identity.npub;
    if (copyClaimNpub) copyClaimNpub.disabled = false;
    if (publishClaimButton && !publishing) publishClaimButton.disabled = false;
    if (claimProofLink) {
      claimProofLink.href = claimProofComposerUrl(identity.npub);
      claimProofLink.target = "_blank";
      claimProofLink.rel = "noreferrer";
      claimProofLink.setAttribute("aria-disabled", "false");
    }
  };

  const browserSigner = (): NostrSigner | null => {
    const signer = (window as typeof window & { nostr?: Partial<NostrSigner> })
      .nostr;
    return typeof signer?.getPublicKey === "function" &&
      typeof signer.signEvent === "function"
      ? (signer as NostrSigner)
      : null;
  };

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (searchTimer !== null) window.clearTimeout(searchTimer);
    searchTimer = null;
    const value = searchInput?.value ?? "";
    void reloadProfiles(value);
    document
      .querySelector("#directory")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  searchInput?.addEventListener("input", (event) => {
    if (searchTimer !== null) window.clearTimeout(searchTimer);
    const search = (event.target as HTMLInputElement).value;
    searchTimer = window.setTimeout(() => {
      searchTimer = null;
      void reloadProfiles(search);
    }, 300);
  });

  document
    .querySelector("#profile-results")
    ?.addEventListener(
      "error",
      (event) => {
        const image = event.target;
        if (
          image instanceof HTMLImageElement &&
          image.classList.contains("avatar-image")
        ) {
          image.remove();
        }
      },
      true,
    );

  document.addEventListener("click", (event) => {
    const copyButton = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-copy-npub]",
    );
    if (copyButton?.dataset.copyNpub) {
      void copyNpub(copyButton.dataset.copyNpub, copyButton);
    }
  });

  document
    .querySelector("#profile-results")
    ?.addEventListener("click", (event) => {
      const clearFilters = (
        event.target as HTMLElement
      ).closest<HTMLButtonElement>("#clear-filters");
      if (clearFilters) {
        query = "";
        category = "Popular on X.com";
        currentPage = 1;
        if (searchInput) searchInput.value = "";
        document
          .querySelectorAll<HTMLButtonElement>("[data-category]")
          .forEach((tab) => {
            const selected = tab.dataset.category === "Popular on X.com";
            tab.classList.toggle("selected", selected);
            tab.setAttribute("aria-selected", String(selected));
          });
        void reloadProfiles("");
      }
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-open-profile-dialog]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        profileDialog?.showModal();
      });
    });

  claimProofLink?.addEventListener("click", (event) => {
    if (!claimIdentity) event.preventDefault();
  });

  connectClaimButton?.addEventListener("click", async () => {
    const signer = browserSigner();
    if (!signer) {
      setClaimStatus(
        "No NIP-07 signer was found. Install or unlock a Nostr browser extension, then retry.",
        "error",
      );
      return;
    }

    connectClaimButton.disabled = true;
    setClaimStatus("Waiting for your Nostr signer…", "working");
    try {
      showClaimIdentity(await connectClaimSigner(signer));
      setClaimStatus(CLAIM_COPY.signerConnected, "success");
    } catch (error) {
      clearClaimIdentity();
      setClaimStatus(
        error instanceof Error
          ? error.message
          : "The Nostr signer could not be connected.",
        "error",
      );
    } finally {
      connectClaimButton.disabled = false;
    }
  });

  copyClaimNpub?.addEventListener("click", () => {
    if (claimIdentity) void copyNpub(claimIdentity.npub, copyClaimNpub);
  });

  claimForm
    ?.querySelectorAll<HTMLButtonElement>("[data-close-claim-dialog]")
    .forEach((button) => {
      button.addEventListener("click", () => profileDialog?.close());
    });

  claimForm?.addEventListener("submit", async (event) => {
    const submitter = (event as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    if (submitter?.value === "cancel") return;
    event.preventDefault();
    if (publishing) return;
    if (!claimForm.reportValidity()) return;

    const formData = new FormData(claimForm);
    const handleInput = claimForm.elements.namedItem(
      "handle",
    ) as HTMLInputElement | null;
    const proofInput = claimForm.elements.namedItem(
      "proofUrl",
    ) as HTMLInputElement | null;

    let started = false;
    const result = await submitXClaim({
      identity: claimIdentity,
      signer: browserSigner(),
      handle: String(formData.get("handle") ?? ""),
      proofUrl: String(formData.get("proofUrl") ?? ""),
      relayConfig: import.meta.env.VITE_DIRECTORY_CLAIM_RELAYS,
      directoryApiUrl,
      getIdentity: () => claimIdentity,
      onStart() {
        started = true;
        publishing = true;
        if (connectClaimButton) connectClaimButton.disabled = true;
        if (publishClaimButton) publishClaimButton.disabled = true;
        setClaimStatus(CLAIM_COPY.working, "working");
      },
    });
    if (
      !result.ok &&
      (result.reason === "invalid-proof" || result.reason === "invalid-handle")
    ) {
      const field = result.field === "handle" ? handleInput : proofInput;
      field?.setCustomValidity(result.fieldMessage);
      field?.reportValidity();
      field?.setCustomValidity("");
    }
    if (!result.ok && result.reason === "signer-changed") clearClaimIdentity();
    if (result.ok) {
      setClaimStatus(
        result.message,
        result.ingestStatus === "rejected" ? "error" : "success",
      );
      if (result.ingestStatus !== "rejected") showToast(result.toast);
    } else {
      setClaimStatus(result.message, "error");
    }
    if (started) {
      publishing = false;
      if (connectClaimButton) connectClaimButton.disabled = false;
      if (publishClaimButton) publishClaimButton.disabled = !claimIdentity;
    }
  });

  profileDialog?.addEventListener("click", (event) => {
    if (event.target === profileDialog) profileDialog.close();
  });

  profileDialog?.addEventListener("close", () => {
    const next = claimDialogAfterClose({
      publishing,
      hasIdentity: claimIdentity !== null,
      status: (claimStatus?.dataset.state as ClaimStatusState) || "idle",
    });
    if (!next) return;
    if (publishClaimButton) publishClaimButton.disabled = next.publishDisabled;
    setClaimStatus(next.statusMessage, next.status);
  });
}

function markNpubCopied(button: HTMLButtonElement): void {
  button.classList.add("copied");
  showToast("Nostr public key copied to clipboard.");
  window.setTimeout(() => button.classList.remove("copied"), 1400);
}

async function copyNpub(
  npub: string,
  button: HTMLButtonElement,
): Promise<void> {
  try {
    window.focus();
    button.focus({ preventScroll: true });
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(npub);
    markNpubCopied(button);
  } catch {
    if (copyWithSelection(npub)) {
      markNpubCopied(button);
      return;
    }
    showToast("Nostr public key could not be copied.");
  }
}

function copyWithSelection(value: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "2em";
  textarea.style.height = "2em";
  textarea.style.padding = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.boxShadow = "none";
  textarea.style.background = "transparent";
  document.body.append(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

boot();
