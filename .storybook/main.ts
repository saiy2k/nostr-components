import type { StorybookConfig } from '@storybook/web-components-vite';

const getStories = () => {
  if (process.env.STORYBOOK_ENV === 'production') {
    return [
      '../stories/**/*.mdx',
      // Only include public stories, exclude testing stories
      '../stories/NostrFollowButton.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/NostrPost.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/NostrProfile.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-profile-badge/NostrProfileBadge.stories.@(js|jsx|mjs|ts|tsx)',
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

  // Add this line to serve the 'dist' directory
  staticDirs: ['../dist'],
};
export default config;
