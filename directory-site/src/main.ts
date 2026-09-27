import "./styles.css";
import { type DirectoryCategory, type DirectoryProfile } from "./data";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  getPaginationPageList,
  getRequiredBatchOffsets,
  getVisibleProfiles,
  nip05ProfileUrl,
  paginateProfiles,
  profileAvatarHtml,
  xProfileUrl,
  truncateNpub,
  type DirectorySort,
} from "./directory";
import { brandMark, icon, networkGraphic } from "./icons";
import {
  DEFAULT_DIRECTORY_API_URL,
  DIRECTORY_BATCH_SIZE,
  fetchDirectoryPageAtOffset,
  type DirectoryPage,
} from "./api";
import {
  claimProofComposerUrl,
  connectClaimSigner,
  // parseGithubProfile,
  // parseYoutubeChannel,
  type NostrSigner,
} from "./claim";
import {
  CLAIM_COPY,
  claimDialogAfterClose,
  submitXClaim,
  type ClaimStatusState,
} from "./claim-flow";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) throw new Error("Nostr Atlas app root was not found.");

const app = appRoot;

const directoryApiUrl =
  import.meta.env.VITE_DIRECTORY_API_URL?.trim() || DEFAULT_DIRECTORY_API_URL;
let profileBatches = new Map<number, DirectoryProfile[]>();
let batchNextCursors = new Map<number, string | null>();
let previewProfiles: DirectoryProfile[] = [];
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
let claimIdentity: { pubkey: string; npub: string } | null = null;

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#039;",
        '"': "&quot;",
      })[character] ?? character,
  );

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
      ? "Please retry using the button below."
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
  const refresh =
    document.querySelector<HTMLButtonElement>("#refresh-directory");
  const cachedProfiles = [...profileBatches.values()].reduce(
    (count, batch) => count + batch.length,
    0,
  );
  if (status) {
    status.textContent = loadFailed
      ? "Could not load verified accounts. Check your connection and retry. Local previews are kept."
      : loading
        ? "Loading verified accounts…"
        : `${directoryTotal} verified X ${directoryTotal === 1 ? "account" : "accounts"} in the directory; ${cachedProfiles} cached in this browser.`;
  }
  if (refresh) {
    refresh.disabled = loading;
    refresh.textContent = loadFailed ? "Retry" : "Refresh";
  }
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
    query = previousQuery;
    const searchInput =
      document.querySelector<HTMLInputElement>("#directory-search");
    if (searchInput && searchInput.value.trim() === nextQuery) {
      searchInput.value = previousQuery;
    }
    renderProfiles();
    return;
  }
  if (!loadFailed) currentPage = 1;
}

async function ensureCurrentPageLoaded(): Promise<void> {
  await loadProfileBatches(requiredBatchOffsets());
}

function renderApp(): void {
  app.innerHTML = `
    <header class="site-header">
      <div class="shell header-inner">
        <a class="brand" href="#top" aria-label="Nostr Atlas home">
          ${brandMark()}<span>Nostr Atlas</span>
        </a>
      </div>
    </header>

    <main id="top">
      <section class="hero shell" aria-labelledby="hero-heading">
        <div class="hero-copy">
          <h1 id="hero-heading">Receive zaps on X.com and YouTube.</h1>
          <p>Claim the accounts people already know, connect them to your Nostr identity, and give supporters a clear path to zap you across the web.</p>
          <button class="primary-button hero-cta" type="button" data-open-profile-dialog>
            ${icon.plusUser()}<span>Claim your X account</span>
          </button>
          <form class="hero-search" id="hero-search" role="search">
            <label class="sr-only" for="directory-search">Search verified accounts</label>
            ${icon.search()}
            <input id="directory-search" type="search" autocomplete="off" maxlength="255" placeholder="Search X handle, NIP-05, or npub" />
            <button type="submit" aria-label="Search verified accounts">${icon.arrow()}</button>
          </form>
        </div>
        <div class="hero-network">${networkGraphic()}</div>
      </section>

      <section class="directory shell" id="directory" aria-label="Verified accounts">
        <div class="directory-heading-row">
          <p id="result-count" aria-live="polite"></p>
        </div>

        <div class="profile-table" role="region" aria-label="Verified accounts" tabindex="0">
          <div class="table-header" aria-hidden="true">
            <span>X account</span><span>Nostr address</span><span>npub (click to copy)</span><span></span>
          </div>
          <div id="profile-results"></div>
        </div>
        <nav class="directory-pagination" id="directory-pagination" aria-label="Directory pagination" hidden></nav>
        <div class="directory-data-controls">
          <p id="directory-status" role="status" aria-live="polite"></p>
          <div class="directory-data-actions">
            <button class="secondary-button" type="button" id="refresh-directory">Refresh</button>
          </div>
        </div>
      </section>

      <section class="how-it-works" id="how-it-works" aria-labelledby="steps-heading">
        <div class="shell steps-layout">
          <h2 id="steps-heading">From X or YouTube<br />to Nostr zaps</h2>
          <ol class="steps-list">
            <li><span class="step-number">1</span><span><strong>Claim</strong><small>Start with the X or YouTube account your audience already recognizes.</small></span></li>
            <li><span class="step-number">2</span><span><strong>Connect</strong><small>Associate it with your Nostr public key and NIP-05 address.</small></span></li>
            <li><span class="step-number">3</span><span><strong>Receive zaps</strong><small>Supporters with <a href="https://github.com/saiy2k/nostr-components/tree/main/browser-extension" target="_blank" rel="noreferrer">our extension</a> installed can zap you on X.com and YouTube.</small></span></li>
          </ol>
        </div>
      </section>
    </main>

    <footer class="site-footer" id="about">
      <div class="shell footer-inner">
        <div class="footer-brand">${brandMark()}<strong>Nostr Atlas</strong><i aria-hidden="true"></i><span>Built to help creators receive zaps on X.com and YouTube.</span></div>
        <nav aria-label="Footer navigation">
          <a href="https://nostr.how/en/what-is-nostr" target="_blank" rel="noreferrer">What is Nostr?</a>
          <a href="https://www.youtube.com/watch?v=0YDj1QdL2Zs" target="_blank" rel="noreferrer">Explainer video</a>
          <a href="https://github.com/saiy2k/nostr-components" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </footer>

    <dialog class="profile-dialog" id="profile-dialog" aria-labelledby="profile-dialog-title">
      <form method="dialog" class="dialog-card claim-dialog-card" id="claim-account-form">
        <div class="dialog-heading">
          <div><h2 id="profile-dialog-title">Claim your X account</h2><p>Publish a signed NIP-39 proof so the directory can verify your X account without receiving your private key.</p></div>
          <button class="icon-button" value="cancel" type="submit" aria-label="Close claim dialog">${icon.close()}</button>
        </div>
        <ol class="claim-steps">
          <li>
            <span class="claim-step-number">1</span>
            <div class="claim-step-content">
              <strong>Connect your Nostr signer</strong>
              <p>Use a NIP-07 browser extension. Nostr Atlas asks it to sign the claim; your private key never enters this site.</p>
              <button class="secondary-button" type="button" id="connect-claim-signer">Connect Nostr signer</button>
              <div class="claim-identity">
                <code id="claim-npub">Not connected</code>
                <button class="text-button" type="button" id="copy-claim-npub" disabled>Copy npub</button>
              </div>
            </div>
          </li>
          <li>
            <span class="claim-step-number">2</span>
            <div class="claim-step-content">
              <strong>Post proof from your X account</strong>
              <p>The proof tweet must contain the connected npub. Its author must match the handle below.</p>
              <div class="claim-account-fields">
                <label>X handle<input name="handle" required maxlength="16" pattern="@?[A-Za-z0-9_]{1,15}" placeholder="@satoshi" autocomplete="off" /></label>
                <p class="claim-extra-link">DM me in Nostr to link to your YouTube channel and receive zaps.</p>
                <!--
                <label><span>YouTube channel (optional)</span><input name="youtube" type="url" inputmode="url" placeholder="https://www.youtube.com/@satoshi" autocomplete="off" /></label>
                <label><span>GitHub profile (optional)</span><input name="github" type="url" inputmode="url" placeholder="https://github.com/satoshi" autocomplete="off" /></label>
                -->
              </div>
              <a class="secondary-button claim-proof-link" id="claim-proof-link" aria-disabled="true">Open proof text on X</a>
            </div>
          </li>
          <li>
            <span class="claim-step-number">3</span>
            <div class="claim-step-content">
              <strong>Sign and publish the claim</strong>
              <label>Proof tweet URL<input name="proofUrl" required type="url" inputmode="url" placeholder="https://x.com/satoshi/status/…" /></label>
              <p>The signed event is published to public Nostr relays. Verification runs asynchronously, so the account may take time to appear.</p>
            </div>
          </li>
        </ol>
        <div class="claim-status" id="claim-status" role="status" aria-live="polite">
          Connect a signer to begin.
        </div>
        <div class="dialog-actions">
          <button class="secondary-button" value="cancel" type="submit">Cancel</button>
          <button class="primary-button" value="default" type="submit" id="publish-claim" disabled>Sign and publish claim</button>
        </div>
      </form>
    </dialog>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`;

  renderProfiles();
  bindEvents();
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
  document
    .querySelector("#refresh-directory")
    ?.addEventListener("click", () => {
      if (loadFailed && loaded && requiredBatchOffsets().length > 0) {
        void ensureCurrentPageLoaded();
      } else void reloadProfiles();
    });

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
    void reloadProfiles(searchInput?.value ?? "");
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

  document.querySelector("#profile-results")?.addEventListener(
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

  document
    .querySelector("#profile-results")
    ?.addEventListener("click", (event) => {
      const copyButton = (
        event.target as HTMLElement
      ).closest<HTMLButtonElement>("[data-copy-npub]");
      if (copyButton?.dataset.copyNpub)
        void copyNpub(copyButton.dataset.copyNpub, copyButton);

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
    /*
    const youtube = parseYoutubeChannel(String(formData.get("youtube") ?? ""));
    const github = parseGithubProfile(String(formData.get("github") ?? ""));
    const youtubeInput = claimForm.elements.namedItem(
      "youtube",
    ) as HTMLInputElement | null;
    const githubInput = claimForm.elements.namedItem(
      "github",
    ) as HTMLInputElement | null;
    if (youtube.status === "invalid") {
      youtubeInput?.setCustomValidity(
        "Use a YouTube channel link, such as https://www.youtube.com/@name.",
      );
      youtubeInput?.reportValidity();
      youtubeInput?.setCustomValidity("");
      setClaimStatus("The YouTube link must be a channel URL.", "error");
      return;
    }
    if (github.status === "invalid") {
      githubInput?.setCustomValidity(
        "Use a GitHub profile link, such as https://github.com/name.",
      );
      githubInput?.reportValidity();
      githubInput?.setCustomValidity("");
      setClaimStatus("The GitHub link must be a profile URL.", "error");
      return;
    }
    const profileLinks = [youtube, github].flatMap((link) =>
      link.status === "ok" ? [link.link] : [],
    );
    */

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
    if (!navigator.clipboard?.writeText)
      throw new Error("Clipboard API unavailable");
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

function showToast(message: string): void {
  const toast = document.querySelector<HTMLDivElement>("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

renderApp();
void reloadProfiles();
