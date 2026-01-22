import { addons } from '@storybook/manager-api';
import { themes } from 'storybook/theming';

addons.setConfig({
  storySort: {
    order: [
      'Introduction', 
      'Zap Button',
      'Follow Button', 
      'Like Button', 
      'Profile Badge',
      'Profile', 
      'Post',
      'Stream',
      'Documentation'
    ],
  },
  initialActive: 'Introduction',
  theme: {
    ...themes.dark,
    brandTitle: 'Nostr Components',
    brandUrl: 'https://nostr-components.web.app/',
  },
});
