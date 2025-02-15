import { addons } from '@storybook/addons';
// import { STORYBOOK_DEFAULTS } from '@storybook/core-common';

addons.setConfig({
  storySort: {
    order: ['Introduction', 'Components', 'Documentation'],
  },
  initialActive: 'Introduction',
});

