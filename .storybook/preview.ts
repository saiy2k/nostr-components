import type { Preview } from '@storybook/web-components-vite';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      brandTitle: 'Nostr Components',
      brandUrl: 'https://nostr-components.web.app/',
    },
  },

  tags: ['autodocs']
};

export default preview;
