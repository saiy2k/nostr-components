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
  decorators: [
    (story, context) => {
      // Check if story has dark theme
      const isDarkTheme = context.args?.['data-theme'] === 'dark';
      
      // Apply background to body
      if (isDarkTheme) {
        document.body.style.backgroundColor = '#000000';
      } else {
        document.body.style.backgroundColor = '';
      }
      
      return story();
    },
  ],
};

export default preview;
