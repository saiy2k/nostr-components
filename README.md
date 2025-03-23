# Nostr Components

**Take Nostr content beyond Nostr clients – embed it anywhere on the internet.**

## 🚀 About the Project

Nostr Components makes it easy to embed **Nostr profiles, posts, and follow buttons** in any website. Inspired by [fiatjaf's Nostr Web Components](https://unpkg.com/nostr-web-components@0.0.6/demo.html). this project **adds a beautiful UI, a storybook component generator (for webmasters),** and expands the usability of Nostr across the web.

## 🏗️ Available Components

🔹 **[Nostr Profile Badge](#-nostr-profile-badge)** - Compact badge-style profile display  
🔹 **[Nostr Profile](#-nostr-profile)** - Full Nostr profile with more details  
🔹 **[Nostr Post](#-nostr-post)** - Embed a specific Nostr post  
🔹 **[Nostr Follow](#-nostr-follow)** - Follow button for Nostr

### Future roadmap:
🔹 Zap button.  
🔹 Wordpress plugin wrapping all the components - Think you install this WP plugin, configure it with your npub that has a LN-URL. And instantly you get a zap button for all your blog posts.  

## 📌 Why Use Nostr Components?

✅ **No Dependencies** - Just a simple script to include.  
✅ **Lightweight & Fast** - Works on any modern browser.  
✅ **Fully Customizable** - Match your website’s style with ease.  
✅ **Decentralized Friendly** - Works seamlessly with any custom set of Nostr relays.

## 🛠️ Usage

## 1. Nostr Profile Badge 🔖 

A small badge displaying a Nostr profile with a username and avatar.

**Usage:**
```
<head>
  <script src="./dist/nostr-profile-badge.js"></script>
</head>
<body>
  <nostr-profile-badge pubkey="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"></nostr-profile-badge>
</body>
```

**Preview:**

![Preview of profile badge](images/profile-badge-preview.png)

---

## 2. Nostr Profile 👤

A detailed profile card showing avatar, name, bio, notes count, followers, etc,.

**Usage:**

```
<head>
  <script src="./dist/nostr-profile.js"></script>
</head>
<body>
  <nostr-profile pubkey="npub1a2cww4kn9wqte4ry70vyfwqyqvpswksna27rtxd8vty6c74era8sdcw83a"></nostr-profile>
</body>
```

**Preview:**

![Preview of profile](images/profile-preview.png)

---

## 3. Nostr Post 📝 

Embed any Nostr post by providing the event ID.

**Usage:**

```
<head>
  <script src="./dist/nostr-post.js"></script>
</head>
<body>
  <nostr-profile pubkey="note1t2jvt5vpusrwrxkfu8x8r7q65zzvm32xuur6y7am4zn475r8ucjqmwwhd2"></nostr-profile>
</body>
```

**Preview:**

![Preview of post](images/post-preview.png)

---

## 4. Nostr Follow ➕ 

A simple button that allows users to follow a Nostr profile.

**Usage:**

```
<head>
  <script src="./dist/nostr-follow-button.js"></script>
</head>
<body>
  <nostr-follow-button pubkey="npub1qsvv5ttv6mrlh38q8ydmw3gzwq360mdu8re2vr7rk68sqmhmsh4svhsft3"></nostr-follow-button>
</body>
```

**Preview:**

![Preview of follow button](images/follow-button-preview.png)

---

## 📖 Documentation, Examples and Demo

Check out our full documentation [here](https://nostr-components.web.app).  

---

## 🤝 Contributing

We welcome contributions!  
Feel free to submit issues, feature requests, or PRs on [GitHub](https://github.com/saiy2k/nostr-components/issues).

---

## 📝 License

This project is licensed under the MIT License.

---
💙 **Spread Nostr Everywhere!** 🚀
