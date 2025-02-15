// Introduction.stories.ts

import { Meta } from '@storybook/web-components'; // Import the Meta from '@storybook/web-components'

export default {
  title: 'Introduction',
} as Meta;

export const Introduction = () => {
  return (
    `<div>
      <h1>Welcome to Nostr Components!</h1>
      <p>This is the Introduction Page for the Web Components Storybook.</p>
      <p>You can use this page to provide details about the project, setup instructions, or any other relevant information.</p>
    </div>`
  );
};

