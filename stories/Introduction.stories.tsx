// Introduction.stories.ts

import { Meta } from '@storybook/web-components'; // Import the Meta from '@storybook/web-components'

export default {
  title: 'Introduction',
} as Meta;

export const Introduction = () => {
  return (
    `<div style="max-width: 800px">
      <h1>Nostr Components!</h1>
      <a href="https://github.com/saiy2k/nostr-components"> View Github repository &gt; </a>
      <p><b>Take Nostr content beyond Nostr clients – embed it anywhere on the internet.</b></p>
      <p>Nostr Components makes it easy to embed Nostr profiles, posts, and follow buttons in any website. Inspired by <a href="https://unpkg.com/nostr-web-components@0.0.6/demo.html">fiatjaf's Nostr Web Components</a>, this project adds a beautiful UI, a storybook component generator (for webmasters), and expands the usability of Nostr across the web.</p>

      <h2> 1. Nostr follow button </h2>
      <script type="module" src="./dist/nostr-follow-button.js"></script>

      Follow saiy2k (author): <br/><nostr-follow-button
        nip05="saiy2k@iris.to"
      ></nostr-follow-button>

      <h2> 2. Nostr post </h2>
      <script type="module" src="./dist/nostr-post.js"></script>

      <nostr-post
        id="note1trkwajmyzqvagxd7052z9dntfeq3yqm0myvnk457tnzpatrlfflq8jzdsn"
        show-stats="true"
      ></nostr-post>

      <h2> 3. Nostr profile </h2>
      <script type="module" src="./dist/nostr-profile.js"></script>

      <nostr-profile
        npub="npub1gcxzte5zlkncx26j68ez60fzkvtkm9e0vrwdcvsjakxf9mu9qewqlfnj5z"
      ></nostr-profile>

      <h2> 4. Nostr profile badge </h2>
      <script type="module" src="./dist/nostr-profile-badge.js"></script>

      <nostr-profile-badge
        nip05="saiy2k@iris.to"
      ></nostr-profile-badge>

    </div>`
  );
};

