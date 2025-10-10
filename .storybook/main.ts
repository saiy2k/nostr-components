import type { StorybookConfig } from '@storybook/web-components-vite';

const getStories = () => {
  if (process.env.STORYBOOK_ENV === 'production') {
    return [
      '../stories/**/*.mdx',
      // Include main component stories
      '../stories/nostr-follow-button/NostrFollowButton.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-post/NostrPost.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-profile/NostrProfile.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-profile-badge/NostrProfileBadge.stories.@(js|jsx|mjs|ts|tsx)',
      // Include styling stories
      '../stories/nostr-follow-button/NostrFollowButton.styling.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-post/NostrPost.styling.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-profile/NostrProfile.styling.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-profile-badge/NostrProfileBadge.styling.stories.@(js|jsx|mjs|ts|tsx)',
    ];
  } else {
    return [
      '../stories/**/*.mdx',
      '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    ];
  }
};

const config: StorybookConfig = {
  stories: getStories(),

  addons: ['@chromatic-com/storybook', '@storybook/addon-docs'],

  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },

  // Add this line to serve the 'dist' and 'images' directories
  staticDirs: [
    '../dist',
    { from: '../images', to: '/images' }
  ],
};
export default config;
