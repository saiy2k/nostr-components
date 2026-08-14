import type { StorybookConfig } from '@storybook/web-components-vite';

const bundleMode = process.env.STORYBOOK_BUNDLE === 'cdn' ? 'cdn' : 'local';

const getStories = () => {
  if (process.env.STORYBOOK_ENV === 'production') {
    return [
      '../stories/**/*.mdx',
      // Include main component stories
      '../stories/nostr-zap/NostrZap.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-follow-button/NostrFollowButton.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-like/NostrLike.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-profile-badge/NostrProfileBadge.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-profile/NostrProfile.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-post/NostrPost.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-livestream/NostrLivestream.stories.@(js|jsx|mjs|ts|tsx)',
      // Include styling stories
      '../stories/nostr-zap/NostrZap.styling.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-follow-button/NostrFollowButton.styling.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-like/NostrLike.styling.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-profile-badge/NostrProfileBadge.styling.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-profile/NostrProfile.styling.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-post/NostrPost.styling.stories.@(js|jsx|mjs|ts|tsx)',
      '../stories/nostr-livestream/NostrLivestream.styling.stories.@(js|jsx|mjs|ts|tsx)',
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

  // Expose STORYBOOK_BUNDLE to preview + story code (snippets).
  env: (config) => ({
    ...config,
    STORYBOOK_BUNDLE: bundleMode,
  }),

  // local: serve this branch's dist. cdn: only images; bundles load from jsDelivr.
  staticDirs:
    bundleMode === 'local'
      ? ['../dist', { from: '../images', to: '/images' }]
      : [{ from: '../images', to: '/images' }],

  // Allow top-level await in preview.ts for ordered bundle loading.
  async viteFinal(config) {
    config.build = config.build || {};
    config.build.target = 'esnext';
    return config;
  },
};

export default config;
