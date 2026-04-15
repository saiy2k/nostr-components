import type { Meta, StoryObj } from '@storybook/web-components';
import { generateBundleScript, generatePreviewHTML, getArgTypes } from './utils';

const meta: Meta = {
  title: 'Fundraiser/Testing/Valid',
  tags: ['test', 'valid'],
  render: args => generatePreviewHTML(args),
  argTypes: getArgTypes(),
  args: {
    width: 760,
    text: 'Support this fundraiser',
  },
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: '.nostr-fundraiser-story-preview',
        config: {
          rules: {
            'color-contrast': { enabled: true },
          },
        },
      },
    },
    docs: {
      description: {
        component: 'Fixture-based valid states for `nostr-fundraiser` so the component can be reviewed visually without requiring a live `kind: 9041` event id.',
      },
      source: {
        code: `${generateBundleScript('nostr-fundraiser')}

<nostr-fundraiser
  hex="PASTE_HEX_OR_USE_NOTEID_OR_EVENTID"
  text="Support this fundraiser">
</nostr-fundraiser>`,
      },
    },
  },
};

export default meta;
type Story = StoryObj<any>;

export const OpenFundraiser: Story = {
  name: 'Open fundraiser',
};

export const GoalReached: Story = {
  name: 'Goal reached',
  render: args => generatePreviewHTML(args, {
    totalRaised: 21_000,
    donorCount: 34,
    percentRaised: 100,
    remainingAmount: 0,
    createdAtLabel: 'Goal reached fixture',
  }),
};

export const ClosedFundraiser: Story = {
  name: 'Closed fundraiser',
  render: args => generatePreviewHTML(args, {
    totalRaised: 19_500,
    donorCount: 27,
    percentRaised: 93,
    remainingAmount: 1_500,
    isClosed: true,
    createdAtLabel: 'Closed fixture',
  }),
};
