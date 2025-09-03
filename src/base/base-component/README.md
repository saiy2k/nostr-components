# NostrBaseComponent

Foundation class for all Nostr web components. This README focuses on two core facilities the base provides:

1. **Status key management** (a generic, extensible status map with attribute reflection and events)
2. **Event delegation** (a single-listener pattern for Shadow DOM)

---

## Quick start

```ts
class MyWidget extends NostrBaseComponent {
  // Define channels (optional sugar)
  protected user = this.channel('user');

  connectedCallback() {
    super.connectedCallback?.();
    // Delegate a click once (no re-binding on rerenders)
    this.delegateEvent('click', '.action', () => this.userAction());
  }

  private async userAction() {
    this.user.set(NCStatus.Loading);
    try {
      // ...do work...
      this.user.set(NCStatus.Ready);
    } catch (e) {
      this.user.set(NCStatus.Error, (e as Error).message);
    }
  }
}
```

In HTML/CSS:

```html
<my-widget relays="wss://relay.example" theme="dark"></my-widget>
```

```css
/* Fine-grained */
my-widget[user-status="loading"] .user-skeleton { display: block; }

/* Broad derived overall */
my-widget[status="error"] .banner { opacity: 1; }
```

---

## Status key management

### What is a “status key”?

A **key** is a named concern whose state you want to expose (e.g. `"connection"`, `"user"`, `"chat"`, `"follow"`). Each key stores an `NCStatus` (`Idle | Loading | Ready | Error`).

The base keeps a **status map** and reflects it:

* **Per-key attribute**: `<key>-status="idle|loading|ready|error"`
  e.g. `connection-status="loading"`, `user-status="error"`
* **Derived overall attribute**: `status="idle|loading|ready|error"`
  Priority: `Error > Loading > Ready > Idle`.

### Reserved key

* `connection` — managed by the base when connecting to Nostr relays.
  Access the preset channel via `this.conn`.

### API surface

* `setStatusFor(key: string, next: NCStatus, errorMessage?: string): void`
  Update a key, reflect attributes, recompute/reflect overall, emit an event.
* `getStatusFor(key: string): NCStatus`
  Read current status (defaults to `Idle`).
* `channel(key: string): { set(s: NCStatus, e?: string): void; get(): NCStatus }`
  Convenience wrapper—create once, reuse.
* `conn`
  Predefined channel for `"connection"`.

### Typical usage patterns

**Declare channels** (recommended for readability):

```ts
protected user = this.channel('user');
protected chat = this.channel('chat');
```

**Set and read**:

```ts
this.user.set(NCStatus.Loading);
if (this.chat.get() === NCStatus.Error) { /* ... */ }
```

**Reflect in UI** (CSS):

```css
:host([user-status="loading"]) .avatar { filter: grayscale(1); }
:host([connection-status="error"]) .conn-banner { display:block; }
```

**Listen to changes** (single, structured event):

```ts
element.addEventListener('nc:status', (e: CustomEvent) => {
  const { key, status, all, overall, errorMessage } = e.detail;
  // key    -> which channel changed (e.g. "user")
  // status -> new NCStatus for that key
  // all    -> snapshot of every key
  // overall-> derived overall status (for global spinners)
});
```

### Error messaging

* If you pass a non-empty `errorMessage` when setting `Error`, it’s stored on the component and included in the `nc:status` payload (`detail.errorMessage`).
* `renderError(message)` returns a simple HTML snippet if you want to inline errors.

### Gotchas & guidance

* Prefer **channels** over raw `setStatusFor` calls—they’re shorter and discourage typos in keys.
* Use concise, kebab-safe strings for keys; they become attribute prefixes.
* Keep the number of keys small and meaningful (e.g., `connection`, `user`, `follow`).

---

## Event delegation

The base provides `delegateEvent(type, selector, handler)` to attach **one listener per (type, selector)** to the Shadow Root and route events by `closest(selector)`.

### Why

* No per-node add/remove on each render.
* Works with full `innerHTML` re-renders.
* Prevents listener leaks and keeps code terse.

### Usage

```ts
connectedCallback() {
  super.connectedCallback?.();
  this.delegateEvent('click', '.copy', (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    this.copyToClipboard(this.profile?.nip05 ?? '');
  });

  this.delegateEvent('click', '.card', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.actions')) return; // guard specific area
    this.openProfile(e as MouseEvent);
  });
}
```

### Priority & guards

If multiple selectors could match, check the **more specific** ones first in a single delegated listener (or add early-return guards in broader handlers). Remember:

* `stopPropagation()` doesn’t prevent other listeners on the **same target**; prefer a single-listener or explicit guards.
* Use `closest(selector)` to match clicks on child nodes.
* For tricky Shadow DOM cases, `e.composedPath()` can help disambiguate origins.

### Accessibility tip

If the clickable thing isn’t a native `<button>`, add keyboard support:

```ts
this.delegateEvent('keydown', '.card', (e) => {
  const k = (e as KeyboardEvent).key;
  if (k === 'Enter' || k === ' ') {
    e.preventDefault();
    this.openProfile();
  }
});
```

---

## Lifecycle recap

* On connect: base validates, applies theme, and manages `connection` status (via `this.conn`).
* Subclasses add their own keys via channels (e.g., `this.user`, `this.chat`) and wire UI with delegated events.

---

## CSS & theming

* Theme is read from the `theme` attribute (`light`|`dark`). Apply host classes/vars in your render as needed.
* Combine derived and per-key attributes for precise styling.
