import type { Meta, StoryObj } from '@storybook/web-components';
import {
  generateBundleScript,
  generateCode,
  generateCodeWithScript,
  generateManualInputHTML,
  generatePreviewHTML,
  getArgTypes,
  DEFAULT_WIDTH,
} from './utils';

const meta: Meta = {
  title: 'Fundraiser',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {
    width: DEFAULT_WIDTH,
    text: 'Zap fundraiser',
    hex: '',
    noteid: '',
    eventid: '',
  },
  parameters: {
    docs: {
      description: {
        component: 'A NIP-75 fundraiser card. Provide exactly one live `kind: 9041` identifier with `hex`, `noteid`, or `eventid` to test banner rendering, progress tallying, donor list, and event-targeted zaps.',
      },
      source: {
        transform: (_code, storyContext) => generateCodeWithScript(storyContext.args),
      },
    },
  },
};

export default meta;
type Story = StoryObj<any>;

export const StaticPreview: Story = {
  name: 'Static Preview',
  args: {
    text: 'Support this fundraiser',
  },
  render: args => generatePreviewHTML(args),
  parameters: {
    docs: {
      description: {
        story: 'Fixture-based preview for quick visual review. Use the manual story below when you want to load a real fundraiser event by `hex`, `noteid`, or `eventid`.',
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

export const ManualInput: Story = {
  name: 'Manual Event Input',
  render: args => generateManualInputHTML(args),
  parameters: {
    docs: {
      description: {
        story: 'This story shows a local preview by default. Paste exactly one fundraiser identifier into `hex`, `noteid`, or `eventid` to switch to the live component. Use `Fundraiser/Testing/Invalid > Missing identifier` when you want to inspect the validation error state.',
      },
    },
  },
};
