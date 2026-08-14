import "./styles.css";
import {
  categories,
  directoryProfiles,
  type DirectoryCategory,
  type DirectoryProfile,
} from "./data";
import {
  formatFollowers,
  getVisibleProfiles,
  truncateNpub,
  type DirectorySort,
} from "./directory";
import { brandMark, icon, networkGraphic } from "./icons";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) throw new Error("Nostr Atlas app root was not found.");

const app = appRoot;

let profiles: DirectoryProfile[] = [...directoryProfiles];
let category: DirectoryCategory = "Trending";
let query = "";
let sort: DirectorySort = "followers";
let verifiedOnly = true;

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
            ${profile.verified ? `<span class="verified-mark" title="Verified identity">${icon.check()}<span class="sr-only">Verified identity</span></span>` : ""}
          </span>
          <span class="profile-handle">${safeHandle}</span>
        </span>
      </div>
      <a class="nip05-link" href="https://${safeNip05.includes("@") ? safeNip05.split("@")[1] : safeNip05}" target="_blank" rel="noreferrer">${safeNip05}</a>
      <span class="profile-category">${profile.category.slice(0, -1)}</span>
      <span class="followers"><strong>${formatFollowers(profile.followers)}</strong><span class="mobile-only"> followers</span></span>
      <span class="verified-cell">${profile.verified ? icon.check() : "—"}<span class="sr-only">${profile.verified ? "Verified" : "Not verified"}</span></span>
      <button class="npub-copy" type="button" data-copy-npub="${safeNpub}" aria-label="Copy public key for ${safeName}">
        <span>${truncateNpub(profile.npub)}</span>
        ${icon.copy()}
      </button>
      <a class="profile-link" href="https://njump.me/${safeNpub}" target="_blank" rel="noreferrer">
        <span>View profile</span>${icon.external()}
      </a>
    </article>`;
}

function renderProfiles(): void {
  const results = document.querySelector<HTMLDivElement>("#profile-results");
  const resultCount = document.querySelector<HTMLElement>("#result-count");
  if (!results || !resultCount) return;

  const visibleProfiles = getVisibleProfiles(profiles, {
    category,
    query,
    sort,
    verifiedOnly,
  });

  resultCount.textContent = `${visibleProfiles.length} ${visibleProfiles.length === 1 ? "identity" : "identities"}`;
  results.innerHTML = visibleProfiles.length
    ? visibleProfiles.map(profileRow).join("")
    : `
      <div class="empty-state">
        <span>${icon.search()}</span>
        <h3>No identities found</h3>
        <p>Try another name, handle, NIP-05 address, or category.</p>
        <button class="text-button" type="button" id="clear-filters">Clear search and filters</button>
      </div>`;
}

function renderApp(): void {
  app.innerHTML = `
    <header class="site-header">
      <div class="shell header-inner">
        <a class="brand" href="#top" aria-label="Nostr Atlas home">
          ${brandMark()}<span>Nostr Atlas</span>
        </a>
        <nav class="desktop-nav" aria-label="Primary navigation">
          <a class="active" href="#directory">Directory</a>
          <a href="#how-it-works">How it works</a>
          <a href="#about">About</a>
        </nav>
        <button class="primary-button desktop-add-profile" type="button" data-open-profile-dialog>
          ${icon.plusUser()}<span>Add your profile</span>
        </button>
        <button class="icon-button mobile-menu-button" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open navigation">
          ${icon.menu()}
        </button>
      </div>
      <nav class="mobile-nav" id="mobile-nav" aria-label="Mobile navigation" hidden>
        <a href="#directory">Directory</a>
        <a href="#how-it-works">How it works</a>
        <a href="#about">About</a>
        <button class="primary-button" type="button" data-open-profile-dialog>${icon.plusUser()} Add your profile</button>
      </nav>
    </header>

    <main id="top">
      <section class="hero shell" aria-labelledby="hero-heading">
        <div class="hero-copy">
          <h1 id="hero-heading">Find your people on Nostr.</h1>
          <p>Search verified identities, creators, builders, and communities across the open social web.</p>
          <form class="hero-search" id="hero-search" role="search">
            <label class="sr-only" for="directory-search">Search the Nostr directory</label>
            ${icon.search()}
            <input id="directory-search" type="search" autocomplete="off" placeholder="Search name, handle, NIP-05, or npub" />
            <button type="submit" aria-label="Search directory">${icon.arrow()}</button>
          </form>
          <div class="proof-line" aria-label="Directory status">
            <span>${icon.check()} <strong><span id="profile-count">${profiles.length}</span> sample identities</strong></span>
            <i aria-hidden="true"></i>
            <span>${icon.database()} Local demo · ready for public Nostr records</span>
          </div>
        </div>
        <div class="hero-network">${networkGraphic()}</div>
      </section>

      <section class="directory shell" id="directory" aria-labelledby="directory-heading">
        <div class="directory-heading-row">
          <div>
            <h2 id="directory-heading">Explore the network</h2>
            <p id="result-count" aria-live="polite"></p>
          </div>
          <div class="directory-controls">
            <button class="filter-button selected" id="verified-filter" type="button" aria-pressed="true">
              ${icon.check()}<span>Verified only</span>
            </button>
            <label class="sort-control">
              <span class="sr-only">Sort directory</span>
              <select id="sort-directory">
                <option value="followers">Most followed</option>
                <option value="name">Name A–Z</option>
              </select>
              ${icon.chevron()}
            </label>
          </div>
        </div>

        <div class="tabs" role="tablist" aria-label="Directory categories">
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

        <div class="profile-table" role="region" aria-label="Nostr identity directory" tabindex="0">
          <div class="table-header" aria-hidden="true">
            <span>Profile</span><span>NIP-05</span><span>Category</span><span>Followers</span><span>Verified</span><span>npub (click to copy)</span><span></span>
          </div>
          <div id="profile-results"></div>
        </div>
      </section>

      <section class="how-it-works" id="how-it-works" aria-labelledby="steps-heading">
        <div class="shell steps-layout">
          <h2 id="steps-heading">From familiar handle<br />to open identity</h2>
          <ol class="steps-list">
            <li><span class="step-number">1</span><span><strong>Search</strong><small>Find people and communities you already know.</small></span></li>
            <li><span class="step-number">2</span><span><strong>Verify</strong><small>Confirm identity through public records and proofs.</small></span></li>
            <li><span class="step-number">3</span><span><strong>Follow</strong><small>Copy an npub and connect on the open social web.</small></span></li>
          </ol>
        </div>
      </section>
    </main>

    <footer class="site-footer" id="about">
      <div class="shell footer-inner">
        <div class="footer-brand">${brandMark()}<strong>Nostr Atlas</strong><i aria-hidden="true"></i><span>Built for the open social web.</span></div>
        <nav aria-label="Footer navigation">
          <a href="https://github.com/nostr-protocol/nostr" target="_blank" rel="noreferrer">Protocol</a>
          <a href="https://github.com/saiy2k/nostr-components" target="_blank" rel="noreferrer">GitHub</a>
          <a href="#privacy">Privacy</a>
        </nav>
      </div>
    </footer>

    <dialog class="profile-dialog" id="profile-dialog" aria-labelledby="profile-dialog-title">
      <form method="dialog" class="dialog-card" id="add-profile-form">
        <div class="dialog-heading">
          <div><h2 id="profile-dialog-title">Add your profile</h2><p>Preview a public Nostr identity in this local directory.</p></div>
          <button class="icon-button" value="cancel" type="submit" aria-label="Close dialog">${icon.close()}</button>
        </div>
        <div class="form-grid">
          <label>Display name<input name="name" required maxlength="50" placeholder="Satoshi" /></label>
          <label>Handle<input name="handle" required maxlength="50" placeholder="@satoshi" /></label>
          <label>NIP-05 address<input name="nip05" required maxlength="100" placeholder="satoshi@example.com" /></label>
          <label>Category<select name="category"><option>Creators</option><option>Builders</option><option>Communities</option></select></label>
          <label class="full-field">Public key<input name="npub" required minlength="20" pattern="npub1.+" placeholder="npub1…" /><small>Public keys must begin with npub1.</small></label>
        </div>
        <div class="dialog-actions">
          <button class="secondary-button" value="cancel" type="submit">Cancel</button>
          <button class="primary-button" value="default" type="submit">Add to preview</button>
        </div>
      </form>
    </dialog>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`;

  renderProfiles();
  bindEvents();
}

function bindEvents(): void {
  const searchForm = document.querySelector<HTMLFormElement>("#hero-search");
  const searchInput =
    document.querySelector<HTMLInputElement>("#directory-search");
  const verifiedFilter =
    document.querySelector<HTMLButtonElement>("#verified-filter");
  const sortSelect =
    document.querySelector<HTMLSelectElement>("#sort-directory");
  const mobileMenuButton = document.querySelector<HTMLButtonElement>(
    ".mobile-menu-button",
  );
  const mobileNav = document.querySelector<HTMLElement>("#mobile-nav");
  const profileDialog =
    document.querySelector<HTMLDialogElement>("#profile-dialog");
  const addProfileForm =
    document.querySelector<HTMLFormElement>("#add-profile-form");

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    query = searchInput?.value ?? "";
    renderProfiles();
    document
      .querySelector("#directory-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  searchInput?.addEventListener("input", (event) => {
    query = (event.target as HTMLInputElement).value;
    renderProfiles();
  });

  document.querySelector(".tabs")?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-category]",
    );
    if (!button) return;
    category = button.dataset.category as DirectoryCategory;
    document
      .querySelectorAll<HTMLButtonElement>("[data-category]")
      .forEach((tab) => {
        const selected = tab === button;
        tab.classList.toggle("selected", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
    renderProfiles();
  });

  verifiedFilter?.addEventListener("click", () => {
    verifiedOnly = !verifiedOnly;
    verifiedFilter.classList.toggle("selected", verifiedOnly);
    verifiedFilter.setAttribute("aria-pressed", String(verifiedOnly));
    verifiedFilter.querySelector("span")!.textContent = verifiedOnly
      ? "Verified only"
      : "All identities";
    renderProfiles();
  });

  sortSelect?.addEventListener("change", (event) => {
    sort = (event.target as HTMLSelectElement).value as DirectorySort;
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
        category = "Trending";
        verifiedOnly = true;
        if (searchInput) searchInput.value = "";
        verifiedFilter?.classList.add("selected");
        verifiedFilter?.setAttribute("aria-pressed", "true");
        const label = verifiedFilter?.querySelector("span");
        if (label) label.textContent = "Verified only";
        document
          .querySelectorAll<HTMLButtonElement>("[data-category]")
          .forEach((tab) => {
            const selected = tab.dataset.category === "Trending";
            tab.classList.toggle("selected", selected);
            tab.setAttribute("aria-selected", String(selected));
          });
        renderProfiles();
      }
    });

  mobileMenuButton?.addEventListener("click", () => {
    if (!mobileNav) return;
    const open = mobileNav.hidden;
    mobileNav.hidden = !open;
    mobileMenuButton.setAttribute("aria-expanded", String(open));
    mobileMenuButton.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation",
    );
  });

  mobileNav?.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("a") && mobileMenuButton) {
      mobileNav.hidden = true;
      mobileMenuButton.setAttribute("aria-expanded", "false");
    }
  });

  document
    .querySelectorAll<HTMLButtonElement>("[data-open-profile-dialog]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        mobileNav?.setAttribute("hidden", "");
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
      formData.get("category") ?? "Creators",
    ) as DirectoryProfile["category"];
    const npub = String(formData.get("npub") ?? "").trim();

    profiles = [
      {
        id: `preview-${Date.now()}`,
        name,
        handle: handle.startsWith("@") ? handle : `@${handle}`,
        nip05: String(formData.get("nip05") ?? "").trim(),
        category: categoryValue,
        followers: 0,
        verified: false,
        npub,
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
      ...profiles,
    ];
    category = "Trending";
    query = "";
    verifiedOnly = false;
    if (searchInput) searchInput.value = "";
    const count = document.querySelector("#profile-count");
    if (count) count.textContent = String(profiles.length);
    profileDialog?.close();
    addProfileForm.reset();
    verifiedFilter?.classList.remove("selected");
    verifiedFilter?.setAttribute("aria-pressed", "false");
    const label = verifiedFilter?.querySelector("span");
    if (label) label.textContent = "All identities";
    document
      .querySelectorAll<HTMLButtonElement>("[data-category]")
      .forEach((tab) => {
        const selected = tab.dataset.category === "Trending";
        tab.classList.toggle("selected", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
    renderProfiles();
    showToast(`${name} was added to this local preview.`);
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
    showToast("Public key copied to clipboard.");
    window.setTimeout(() => button.classList.remove("copied"), 1400);
  } catch {
    if (copyWithSelection(npub)) {
      button.classList.add("copied");
      showToast("Public key copied to clipboard.");
      window.setTimeout(() => button.classList.remove("copied"), 1400);
      return;
    }

    showToast("Clipboard access was unavailable.");
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
