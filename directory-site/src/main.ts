import "./styles.css";
import {
  categories,
  type DirectoryCategory,
  type DirectoryProfile,
} from "./data";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  formatFollowers,
  getPaginationPageList,
  getVisibleProfiles,
  nip05ProfileUrl,
  paginateProfiles,
  truncateNpub,
  type DirectorySort,
} from "./directory";
import { brandMark, icon, networkGraphic } from "./icons";
import { DEFAULT_DIRECTORY_API_URL, fetchNextDirectoryPage } from "./api";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) throw new Error("Nostr Atlas app root was not found.");

const app = appRoot;

const directoryApiUrl =
  import.meta.env.VITE_DIRECTORY_API_URL?.trim() || DEFAULT_DIRECTORY_API_URL;
let profiles: DirectoryProfile[] = [];
let previewProfiles: DirectoryProfile[] = [];
let nextCursor: string | null = null;
let loading = false;
let loaded = false;
let loadFailed = false;
let lastLoadReset = true;
let category: DirectoryCategory = "Popular on X.com";
let query = "";
let sort: DirectorySort = "followers";
let currentPage = 1;
let pageSize = DEFAULT_PAGE_SIZE;

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
  const verificationLabel = profile.verified
    ? "X account ownership verified"
    : "Local preview · not verified";

  return `
    <article class="profile-row" data-profile-id="${escapeHtml(profile.id)}">
      <div class="profile-primary">
        <span
          class="avatar"
          aria-hidden="true"
          style="--avatar-bg:${profile.avatar.background};--avatar-fg:${profile.avatar.foreground}"
        >${escapeHtml(profile.avatar.initials)}</span>
        <span class="profile-name-wrap">
          <span class="profile-name-line">
            <strong>${safeName}</strong>
            ${profile.verified ? `<span class="verified-mark" title="${verificationLabel}">${icon.check()}<span class="sr-only">${verificationLabel}</span></span>` : ""}
          </span>
          <span class="profile-handle">${safeHandle}${profile.verified ? "" : " · Local preview"}</span>
        </span>
      </div>
      ${nip05Url ? `<a class="nip05-link" href="${escapeHtml(nip05Url)}" target="_blank" rel="noreferrer" title="Profile-provided Nostr address">${safeNip05}</a>` : `<span class="nip05-link">${safeNip05 || "—"}</span>`}
      <button class="npub-copy" type="button" data-copy-npub="${safeNpub}" aria-label="Copy Nostr public key for ${safeName}">
        <span>${escapeHtml(truncateNpub(profile.npub))}</span>
        ${icon.copy()}
      </button>
      <span class="followers"${profile.followers === null ? ' title="Audience count unavailable"' : ""}><strong>${formatFollowers(profile.followers)}</strong><span class="mobile-only"> audience</span></span>
      <span class="verified-cell">${profile.verified ? icon.check() : "—"}<span class="sr-only">${verificationLabel}</span></span>
      <span class="youtube-cell">${profile.youtube ? escapeHtml(profile.youtube) : "—"}</span>
      <a class="profile-link" href="https://njump.me/${safeNpub}" target="_blank" rel="noreferrer">
        <span>Open Nostr profile</span>${icon.external()}
      </a>
    </article>`;
}

function renderProfiles(): void {
  const results = document.querySelector<HTMLDivElement>("#profile-results");
  const resultCount = document.querySelector<HTMLElement>("#result-count");
  if (!results || !resultCount) return;

  const visibleProfiles = getVisibleProfiles(
    [...previewProfiles, ...profiles],
    {
      category,
      query,
      sort,
    },
  );

  const pagination = paginateProfiles(visibleProfiles, currentPage, pageSize);
  currentPage = pagination.page;

  const totalLoaded = visibleProfiles.length;
  if (loading && !loaded) {
    resultCount.textContent = "Loading creator claims…";
  } else if (totalLoaded === 0) {
    resultCount.textContent = "0 creator claims";
  } else {
    const claimNoun = totalLoaded === 1 ? "creator claim" : "creator claims";
    resultCount.textContent = `Showing ${pagination.startIndex + 1}–${pagination.endIndex} of ${totalLoaded} ${claimNoun}${nextCursor ? " in loaded results" : ""}`;
  }

  results.setAttribute("aria-busy", String(loading));
  const emptyTitle =
    loading && !loaded
      ? "Loading creator claims…"
      : loadFailed && !loaded
        ? "Creator claims could not be loaded"
        : category === "Popular on Nostr"
          ? "Nostr rankings are not available yet"
          : "No creator claims found";
  const emptyDescription =
    loading && !loaded
      ? "Fetching verified accounts."
      : loadFailed && !loaded
        ? "Please retry using the button below."
        : category === "Popular on Nostr"
          ? "The live directory currently lists verified X accounts. Choose Popular on X.com to browse them."
          : nextCursor
            ? "Try another search or load more creator claims below."
            : "Try an X handle, name, Nostr address, or npub. Only verified X accounts appear in the live directory.";

  results.innerHTML = visibleProfiles.length
    ? pagination.items.map(profileRow).join("")
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
  pagination: ReturnType<typeof paginateProfiles<DirectoryProfile>>,
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
      Showing <strong>${startNumber}–${endNumber}</strong> of <strong>${pagination.totalItems}</strong> claims
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
      <label for="page-size-select" class="sr-only">Claims per page</label>
      <div class="page-size-wrap">
        <select id="page-size-select" aria-label="Claims per page">
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
  const more = document.querySelector<HTMLButtonElement>("#load-more-profiles");
  if (status) {
    status.textContent = loadFailed
      ? "Could not load creator claims. Check your connection and retry. Previously loaded claims and local previews are kept."
      : loading
        ? "Loading verified creator claims…"
        : `${profiles.length} verified X ${profiles.length === 1 ? "account" : "accounts"} loaded. ${nextCursor ? "Search and sorting apply to loaded accounts; load more to expand results. " : ""}Audience counts and YouTube claims are not available yet.`;
  }
  if (refresh) {
    refresh.disabled = loading;
    refresh.textContent = loadFailed ? "Retry" : "Refresh";
  }
  if (more) {
    more.hidden = !nextCursor || category !== "Popular on X.com";
    more.disabled = loading || loadFailed;
    more.textContent = loading ? "Loading…" : "Load more creator claims";
  }
}

async function loadProfiles(reset = true): Promise<void> {
  if (loading) return;
  loading = true;
  loadFailed = false;
  lastLoadReset = reset;
  if (reset) {
    currentPage = 1;
  }
  renderProfiles();
  try {
    const page = await fetchNextDirectoryPage(
      directoryApiUrl,
      reset ? null : nextCursor,
    );
    profiles = [
      ...new Map(
        [...(reset ? [] : profiles), ...page.profiles].map((profile) => [
          profile.id,
          profile,
        ]),
      ).values(),
    ];
    nextCursor = page.nextCursor;
    loaded = true;
  } catch (error) {
    loadFailed = true;
    console.error("Failed to load the creator directory", error);
  } finally {
    loading = false;
    renderProfiles();
  }
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
            ${icon.plusUser()}<span>Claim your X or YouTube account</span>
          </button>
          <form class="hero-search" id="hero-search" role="search">
            <label class="sr-only" for="directory-search">Search creator claims</label>
            ${icon.search()}
            <input id="directory-search" type="search" autocomplete="off" placeholder="Search X, name, NIP-05, or npub" />
            <button type="submit" aria-label="Search creator claims">${icon.arrow()}</button>
          </form>
        </div>
        <div class="hero-network">${networkGraphic()}</div>
      </section>

      <section class="directory shell" id="directory" aria-label="Creator claims">
        <div class="directory-heading-row">
          <p id="result-count" aria-live="polite"></p>
          <label class="sort-control">
            <span class="sr-only">Sort directory</span>
            <select id="sort-directory">
              <option value="followers"${sort === "followers" ? " selected" : ""}>Most followed</option>
              <option value="name"${sort === "name" ? " selected" : ""}>Name A–Z</option>
            </select>
            ${icon.chevron()}
          </label>
        </div>

        <div class="tabs" role="tablist" aria-label="Creator claim categories">
          ${categories
            .map(
              (item) => `
                <button
                  class="tab ${item === category ? "selected" : ""}"
                  type="button"
                  role="tab"
                  aria-selected="${item === category}"
                  data-category="${item}"
                >${item}</button>`,
            )
            .join("")}
        </div>

        <div class="profile-table" role="region" aria-label="Creator claim directory" tabindex="0">
          <div class="table-header" aria-hidden="true">
            <span>Creator</span><span>Nostr address</span><span>npub (click to copy)</span><span>Audience</span><span>X verified</span><span>YouTube channel</span><span></span>
          </div>
          <div id="profile-results"></div>
        </div>
        <nav class="directory-pagination" id="directory-pagination" aria-label="Directory pagination" hidden></nav>
        <div class="directory-data-controls">
          <p id="directory-status" role="status" aria-live="polite"></p>
          <div class="directory-data-actions">
            <button class="secondary-button" type="button" id="refresh-directory">Refresh</button>
            <button class="secondary-button" type="button" id="load-more-profiles" hidden>Load more creator claims</button>
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
          <a href="https://github.com/nostr-protocol/nostr" target="_blank" rel="noreferrer">About Nostr</a>
          <a href="https://github.com/saiy2k/nostr-components" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </footer>

    <dialog class="profile-dialog" id="profile-dialog" aria-labelledby="profile-dialog-title">
      <form method="dialog" class="dialog-card" id="add-profile-form">
        <div class="dialog-heading">
          <div><h2 id="profile-dialog-title">Preview a creator claim</h2><p>See how an X or YouTube account could appear with your Nostr identity. This stays in your browser.</p></div>
          <button class="icon-button" value="cancel" type="submit" aria-label="Close claim preview">${icon.close()}</button>
        </div>
        <div class="form-grid">
          <label>Creator name<input name="name" required maxlength="50" placeholder="Satoshi" /></label>
          <label>X or YouTube handle<input name="handle" required maxlength="50" placeholder="@satoshi" /></label>
          <label>Nostr address (NIP-05)<input name="nip05" required maxlength="100" placeholder="satoshi@example.com" /></label>
          <label>Claim tab<select name="category"><option>Popular on X.com</option><option>Popular on Nostr</option></select></label>
          <label class="full-field">Nostr public key<input name="npub" required minlength="20" pattern="npub1.+" placeholder="npub1…" /><small>Nostr public keys begin with npub1.</small></label>
        </div>
        <div class="dialog-actions">
          <button class="secondary-button" value="cancel" type="submit">Cancel</button>
          <button class="primary-button" value="default" type="submit">Add claim to preview</button>
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
      void loadProfiles(loadFailed ? lastLoadReset : true);
    });
  document
    .querySelector("#load-more-profiles")
    ?.addEventListener("click", () => {
      if (nextCursor) void loadProfiles(false);
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
        scrollToDirectory();
      }
      return;
    }

    const prevBtn = target.closest<HTMLButtonElement>("#pagination-prev");
    if (prevBtn && currentPage > 1) {
      currentPage--;
      renderProfiles();
      scrollToDirectory();
      return;
    }

    const nextBtn = target.closest<HTMLButtonElement>("#pagination-next");
    if (nextBtn) {
      const visibleProfiles = getVisibleProfiles(
        [...previewProfiles, ...profiles],
        { category, query, sort },
      );
      const totalPages = Math.max(
        1,
        Math.ceil(visibleProfiles.length / pageSize),
      );
      if (currentPage < totalPages) {
        currentPage++;
        renderProfiles();
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
      scrollToDirectory();
    }
  });

  const searchForm = document.querySelector<HTMLFormElement>("#hero-search");
  const searchInput =
    document.querySelector<HTMLInputElement>("#directory-search");
  const sortSelect =
    document.querySelector<HTMLSelectElement>("#sort-directory");
  const profileDialog =
    document.querySelector<HTMLDialogElement>("#profile-dialog");
  const addProfileForm =
    document.querySelector<HTMLFormElement>("#add-profile-form");

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    query = searchInput?.value ?? "";
    currentPage = 1;
    renderProfiles();
    document
      .querySelector("#directory")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  searchInput?.addEventListener("input", (event) => {
    query = (event.target as HTMLInputElement).value;
    currentPage = 1;
    renderProfiles();
  });

  sortSelect?.addEventListener("change", (event) => {
    sort = (event.target as HTMLSelectElement).value as DirectorySort;
    currentPage = 1;
    renderProfiles();
  });

  document.querySelector(".tabs")?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-category]",
    );
    if (!button) return;
    category = button.dataset.category as DirectoryCategory;
    currentPage = 1;
    document
      .querySelectorAll<HTMLButtonElement>("[data-category]")
      .forEach((tab) => {
        const selected = tab === button;
        tab.classList.toggle("selected", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
    renderProfiles();
  });

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
        sort = "followers";
        currentPage = 1;
        if (searchInput) searchInput.value = "";
        if (sortSelect) sortSelect.value = "followers";
        document
          .querySelectorAll<HTMLButtonElement>("[data-category]")
          .forEach((tab) => {
            const selected = tab.dataset.category === "Popular on X.com";
            tab.classList.toggle("selected", selected);
            tab.setAttribute("aria-selected", String(selected));
          });
        renderProfiles();
      }
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-open-profile-dialog]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        profileDialog?.showModal();
      });
    });

  addProfileForm?.addEventListener("submit", (event) => {
    const submitter = (event as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    if (submitter?.value === "cancel") return;
    event.preventDefault();
    if (!addProfileForm.reportValidity()) return;

    const formData = new FormData(addProfileForm);
    const name = String(formData.get("name") ?? "").trim();
    const handle = String(formData.get("handle") ?? "").trim();
    const categoryValue = String(
      formData.get("category") ?? "Popular on X.com",
    ) as DirectoryProfile["category"];
    const npub = String(formData.get("npub") ?? "").trim();

    previewProfiles = [
      {
        id: `preview-${Date.now()}`,
        name,
        handle: handle.startsWith("@") ? handle : `@${handle}`,
        nip05: String(formData.get("nip05") ?? "").trim(),
        category: categoryValue,
        followers: null,
        verified: false,
        npub,
        youtube: "",
        avatar: {
          initials: name
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
          foreground: "#ffffff",
          background: "#7456f6",
        },
      },
      ...previewProfiles,
    ];
    category = categoryValue;
    query = "";
    currentPage = 1;
    if (searchInput) searchInput.value = "";
    profileDialog?.close();
    addProfileForm.reset();
    document
      .querySelectorAll<HTMLButtonElement>("[data-category]")
      .forEach((tab) => {
        const selected = tab.dataset.category === categoryValue;
        tab.classList.toggle("selected", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
    renderProfiles();
    showToast(`${name} was added to your local claim preview.`);
  });

  profileDialog?.addEventListener("click", (event) => {
    if (event.target === profileDialog) profileDialog.close();
  });
}

async function copyNpub(
  npub: string,
  button: HTMLButtonElement,
): Promise<void> {
  try {
    if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(npub);
    button.classList.add("copied");
    showToast("Nostr public key copied to clipboard.");
    window.setTimeout(() => button.classList.remove("copied"), 1400);
  } catch {
    if (copyWithSelection(npub)) {
      button.classList.add("copied");
      showToast("Nostr public key copied to clipboard.");
      window.setTimeout(() => button.classList.remove("copied"), 1400);
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
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
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
void loadProfiles();
