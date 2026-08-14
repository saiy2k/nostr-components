import type { StorybookConfig } from '@storybook/web-components-vite';

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

  // Components load from jsDelivr in preview-head.html; only local images are served here.
  staticDirs: [{ from: '../images', to: '/images' }],

  // SPA fallback so /zap-button deep links work in `storybook dev`.
  async viteFinal(config) {
    const existingPlugins = config.plugins ?? [];
    return {
      ...config,
      appType: 'spa',
      plugins: [
        ...existingPlugins,
        {
          name: 'storybook-clean-url-fallback',
          configureServer(server) {
            server.middlewares.use((req, _res, next) => {
              const url = req.url ?? '';
              if (
                req.method !== 'GET' ||
                url.startsWith('/@') ||
                url.startsWith('/node_modules') ||
                url.startsWith('/sb-') ||
                url.startsWith('/iframe.html') ||
                url.startsWith('/index.json') ||
                url.startsWith('/images/') ||
                url.startsWith('/themes') ||
                url.includes('.')
              ) {
                next();
                return;
              }
              if (url !== '/' && !url.startsWith('/?')) {
                req.url = '/';
              }
              next();
            });
          },
        },
      ],
    };
  },
};
export default config;
