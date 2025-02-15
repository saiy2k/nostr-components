# Nostr Components

**Take Nostr content beyond Nostr clients – embed it anywhere on the internet.**

## 🚀 About the Project

Nostr Components makes it easy to embed **Nostr profiles, posts, and follow buttons** in any website. Inspired by [fiatjaf's Nostr Web Components](https://unpkg.com/nostr-web-components@0.0.6/demo.html). this project **adds a beautiful UI, a storybook component generator (for webmasters),** and expands the usability of Nostr across the web.

## ✨ Features

- **Embed your Nostr Identity** – Display your profile on any website.
- **Follow Button** – Let visitors follow you on Nostr with one click.
- **Embed Nostr Posts** – Share any Nostr post outside of Nostr apps.

## 🏗️ Available Components

🔹 **[Nostr Profile Badge](#-nostr-profile-badge)** – Compact badge-style profile display  
🔹 **[Nostr Profile](#-nostr-profile)** – Full Nostr profile with more details  
🔹 **[Nostr Post](#-nostr-post)** – Embed a specific Nostr post  
🔹 **[Nostr Follow](#-nostr-follow)** – Follow button for Nostr
🔹 More coming

## 📌 Why Use Nostr Components?

✅ **No Dependencies** – Just a simple script to include.  
✅ **Lightweight & Fast** – Works on any modern browser.  
✅ **Fully Customizable** – Match your website’s style with ease.  
✅ **Decentralized Friendly** – Works seamlessly with any Nostr relay.  

## 🛠️ Usage

### 1️⃣ Add the script to your HTML
```html
<script src="https://yourcdn.com/nostr-components.js"></script>
```


### 2️⃣ Use Components Anywhere

---

## 🔖 Nostr Profile Badge

A small badge displaying a Nostr profile with a username and avatar.

**Usage:**
\`\`\`html
<nostr-profile-badge pubkey="npub1...."></nostr-profile-badge>
\`\`\`

✅ Displays a compact version of a Nostr profile.  
✅ Ideal for sidebars, author badges, or quick profile references.  

[🔗 View Demo](#-demo)

---

## 👤 Nostr Profile

A detailed profile card showing avatar, name, bio, and other Nostr details.

**Usage:**
\`\`\`html
<nostr-profile pubkey="npub1...."></nostr-profile>
\`\`\`

✅ Full profile information including name, display picture, and bio.  
✅ Supports custom themes and sizes.  

[🔗 View Demo](#-demo)

---

## 📝 Nostr Post

Embed any Nostr post by providing the event ID.

**Usage:**
\`\`\`html
<nostr-post event-id="note1...."></nostr-post>
\`\`\`

✅ Displays any public Nostr post with formatting.  
✅ Auto-updates when the post changes.  

[🔗 View Demo](#-demo)

---

## ➕ Nostr Follow

A simple button that allows users to follow a Nostr profile.

**Usage:**
\`\`\`html
<nostr-follow pubkey="npub1...."></nostr-follow>
\`\`\`

✅ One-click follow button for any Nostr identity.  
✅ Perfect for personal websites, blogs, and profile pages.  

[🔗 View Demo](#-demo)

---

## 🎨 Customization

You can customize components with attributes like `theme`, `size`, and `style`.  
Example:
\`\`\`html
<nostr-profile pubkey="npub1...." theme="dark" size="large"></nostr-profile>
\`\`\`

Available options:
- `theme`: `"light"`, `"dark"`
- `size`: `"small"`, `"medium"`, `"large"`

---

## 📖 Documentation & Examples

Check out our full documentation [here](https://yourwebsite.com/docs).  
Use the **Storybook Component Generator** to preview and tweak components before embedding.

---

## 🎬 Demo

Try the live demo showcasing all components:  
👉 **[Live Demo](https://yourwebsite.com/demo)**

---

## 🤝 Contributing

We welcome contributions!  
Feel free to submit issues, feature requests, or PRs on [GitHub](https://github.com/your-repo/nostr-components).

---

## 📝 License

This project is licensed under the MIT License.

---
💙 **Spread Nostr Everywhere!** 🚀
