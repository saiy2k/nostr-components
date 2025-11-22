# Nostr Components

**Embed Nostr anywhere on the internet, a Zap Button for every webpage.**

## 🚀 About the Project

Nostr Components makes it easy to embed Zap button, Nostr profiles, posts, and follow buttons in any website. Inspired by <a href="https://unpkg.com/nostr-web-components@0.0.15/demo.html">fiatjaf's Nostr Web Components</a>, this project adds a beautiful UI, a Storybook component generator (for webmasters), and allows embedding Nostr content anywhere on the Internet.

🔹 **[Nostr Zap](#5-nostr-zap-)** - Lightning Network zap button for Nostr  
🔹 **[Nostr Profile Badge](#1-nostr-profile-badge-)** - Compact badge-style profile display  
🔹 **[Nostr Profile](#2-nostr-profile-)** - Full Nostr profile with more details  
🔹 **[Nostr Post](#3-nostr-post-)** - Embed a specific Nostr post  
🔹 **[Nostr Follow](#4-nostr-follow-)** - Follow button for Nostr  
🔹 **[Nostr DM](#6-nostr-dm-)** - Send a direct message on Nostr (Under construction)
🔹 **[Nostr Live Chat](#7-nostr-live-chat-)** - Real-time chat with message history (Under construction) 
🔹 **[Nostr Comment](#8-nostr-comment-)** - Decentralized comment system for any website (Under construction) 
🔹 **[WordPress Integration](#9-wordpress-integration)** - WordPress Integration

## 🛠️ Usage

### Option 1: Using with Bundlers (Webpack, Vite, React, etc.)

For modern bundler-based projects (React, Vue, Next.js, etc.):

```typescript
// Import the main package - this automatically registers all components
import 'nostr-components';

// Or import specific components only
import 'nostr-components/components/nostr-like';
import 'nostr-components/components/nostr-zap';

// Import themes
import 'nostr-components/themes/dark';
// or
import 'nostr-components/themes/light';
```

Then use the components in your JSX/HTML:

```tsx
function MyComponent() {
  return (
    <>
      <nostr-like url="https://example.com" text="Like" />
      <nostr-zap npub="npub1..." theme="dark" />
    </>
  );
}
```

**Note:** When importing from the main package (`import 'nostr-components'`), all components are automatically registered. Individual component imports also work and register only that component.

### Option 2: Direct Script Tag Usage

For direct HTML usage without a bundler:

```html
<head>
  <!-- Required: Nostr Components Script (choose UMD or ES) -->
  <script src="./dist/nostr-components.umd.js"></script>
  <!-- Or nostr-components.es.js -->
  <script>
    // Initialize components (only needed for UMD build)
    NostrComponents.default.init();
  </script>

  <!-- Optional: Glide.js CSS for Post Carousel -->
  <!-- Needed only if displaying posts that might contain multiple images/videos -->
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@glidejs/glide/dist/css/glide.core.min.css"
  />
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@glidejs/glide/dist/css/glide.theme.min.css"
  />
</head>
```

- **UMD (Universal Module Definition):** Use `<script src="./dist/nostr-components.umd.js"></script>` and the initialization script.
- **ES Module:** Use `<script type="module">import NostrComponents from './dist/nostr-components.es.js'; NostrComponents.init();</script>`.

_Note: Replace `./dist/nostr-components.min.js` with the actual path to the file on your server or use a CDN link if available (e.g., `https://nostr-components.web.app/dist/nostr-components.umd.js`)._

### Using the Components

Place the component tags anywhere in your HTML/JSX:

---

## 1. Nostr Profile Badge 🔖

A small badge displaying a Nostr profile with a username and avatar.

**Usage:**

```html
<head>
  <script
    type="module"
    src="./dist/components/nostr-profile-badge.es.js"
  ></script>
</head>
<body>
  <nostr-profile-badge
    pubkey="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"
  ></nostr-profile-badge>
</body>
```

**Preview:**

![Preview of profile badge](images/profile-badge-preview.png)

---

## 2. Nostr Profile 👤

A detailed profile card showing avatar, name, bio, notes count, followers, etc,.

**Usage:**

```html
<head>
  <script type="module" src="./dist/components/nostr-profile.es.js"></script>
</head>
<body>
  <nostr-profile
    pubkey="npub1a2cww4kn9wqte4ry70vyfwqyqvpswksna27rtxd8vty6c74era8sdcw83a"
  ></nostr-profile>
</body>
```

**Preview:**

![Preview of profile](images/profile-preview.png)

---

## 3. Nostr Post 📝

Embed any Nostr post by providing the event ID.

**Usage:**

```html
<head>
  <script type="module" src="./dist/components/nostr-post.es.js"></script>
</head>
<body>
  <nostr-post
    eventId="note1t2jvt5vpusrwrxkfu8x8r7q65zzvm32xuur6y7am4zn475r8ucjqmwwhd2"
  ></nostr-post>
  <!-- Note: The previous example incorrectly used a pubkey, use eventId for posts -->
</body>
```

**Preview:**

![Preview of post](images/post-preview.png)

---

## 4. Nostr Follow ➕

A simple button that allows users to follow a Nostr profile.

**Usage:**

```html
<head>
  <script
    type="module"
    src="./dist/components/nostr-follow-button.es.js"
  ></script>
</head>
<body>
  <nostr-follow-button
    pubkey="npub1qsvv5ttv6mrlh38q8ydmw3gzwq360mdu8re2vr7rk68sqmhmsh4svhsft3"
  ></nostr-follow-button>
</body>
```

**Preview:**

![Preview of follow button](images/follow-button-preview.png)

## 5. Nostr Zap ⚡

A Lightning Network zap button that allows users to send sats to any Nostr user with a lightning address or LNURL.

**Usage:**

```html
<head>
  <script type="module" src="./dist/components/nostr-zap.es.js"></script>
</head>
<body>
  <nostr-zap 
    npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"
    theme="dark"
    button-text="⚡ Zap Me"
    button-color="#8a63d2"
    amount="1000"
  ></nostr-zap>
</body>
```

**Preview:**

![Preview of zap button](images/zap-preview.png)

---

## 6. Nostr DM 💬

A simple direct message composer for sending one-time messages to any Nostr user.

**Usage:**

```html
<head>
  <script type="module" src="./dist/components/nostr-dm.es.js"></script>
</head>
<body>
  <!-- Basic DM, user will be prompted to enter a recipient -->
  <nostr-dm theme="light"></nostr-dm>

  <!-- Pre-configured recipient with npub -->
  <nostr-dm 
    recipient-npub="npub1g53mukxnjkcmr94fhryzkqutdz2ukq4ks0gvy5af25rgmwsl4ngq43drvk"
    theme="light"
    relays="wss://relay.damus.io,wss://relay.primal.net"
  ></nostr-dm>

  <!-- Using NIP-05 identifier -->
  <nostr-dm 
    nip05="user@domain.com"
    theme="dark"
  ></nostr-dm>
</body>
```


**Preview:**

![Preview of DM component](images/dm-preview.png)

---

## 7. Nostr Live Chat 💬

Real-time chat component with persistent message history and live updates.

**Usage:**

```html
<head>
  <script type="module" src="./dist/components/nostr-live-chat.es.js"></script>
</head>
<body>
  <!-- Basic live chat, user will be prompted to enter a recipient -->
  <nostr-live-chat theme="light"></nostr-live-chat>

  <!-- Pre-configured recipient with npub -->
  <nostr-live-chat 
    recipient-npub="npub1g53mukxnjkcmr94fhryzkqutdz2ukq4ks0gvy5af25rgmwsl4ngq43drvk"
    theme="light"
    relays="wss://relay.damus.io,wss://relay.primal.net,wss://relay.snort.social"
  ></nostr-live-chat>

  <!-- Using NIP-05 identifier -->
  <nostr-live-chat 
    nip05="user@domain.com"
    theme="dark"
  ></nostr-live-chat>
</body>
```



**Preview:**

![Preview of live chat component](images/live-chat-preview.png)

---

## 8. Nostr Comment 💬

A complete decentralized comment system that stores comments on the Nostr network instead of a traditional database.

**Usage:**

```html
<head>
  <script type="importmap">
  {
    "imports": {
      "lit": "https://unpkg.com/lit@3.1.0/index.js?module",
      "dayjs": "https://unpkg.com/dayjs@1.11.10/dayjs.min.js?module"
    }
  }
  </script>
  <script type="module" src="./dist/components/nostr-comment.es.js"></script>
</head>
<body>
  <nostr-comment 
    theme="light"
    placeholder="Write a comment..."
    relays="wss://relay.damus.io,wss://nostr.wine,wss://relay.nostr.net"
  ></nostr-comment>
</body>
```

**Preview:**

![Preview of comment system](images/comment-preview.png)

---

## 9. WordPress Integration

Install the Nostr Components plugin from the WordPress plugin directory to easily embed Nostr content in your posts and pages.

---

## 📖 Documentation, Examples and Demo

Check out our full documentation [here](https://nostr-components.web.app).

---

## 🛠️ Development

### Storybook Setup

This project uses Storybook for component development and testing. The setup includes both public showcase stories and private testing stories.

**Development Commands:**

```bash
# Start Storybook in development mode (includes testing stories)
npm run storybook

# Build Storybook for production (excludes testing stories)
STORYBOOK_ENV=production npm run build-storybook
```

**Story Organization:**
- **Public Stories**: Showcase stories for component demos and documentation
- **Testing Stories**: Private stories for development testing (excluded from production builds)

The production build automatically excludes all testing stories to keep the public Storybook clean and focused on showcasing components.

---

## 🤝 Contributing

We welcome contributions!  
Feel free to submit issues, feature requests, or PRs on [GitHub](https://github.com/saiy2k/nostr-components/issues).

---

## 📝 License

This project is licensed under the MIT License.

---

💙 **Spread Nostr Everywhere!** 🚀
