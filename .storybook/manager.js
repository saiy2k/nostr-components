import { addons } from '@storybook/addons';
import { themes } from '@storybook/theming';

addons.setConfig({
  storySort: {
    order: ['Introduction', 'Components', 'Documentation'],
  },
  initialActive: 'Introduction',
  theme: {
    ...themes.dark,
    brandTitle: 'Nostr Components',
    brandUrl: 'https://nostr-components.web.app/',
  },
});
