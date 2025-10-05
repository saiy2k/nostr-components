import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, generateArgTypes } from './testing-utils';
import { INVALID_TEST_CASES } from './test-cases-invalid';

const meta = {
  title: 'NostrPost/Testing/Invalid',
  tags: ['test', 'invalid'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
  args: { onClick: () => {}, onAuthorClick: () => {}, onMentionClick: () => {} },
  parameters: {
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-post',
        config: {
          rules: {
            'color-contrast': { enabled: true },
            'keyboard-navigation': { enabled: true },
          },
        },
      },
    },
  },
};

export default meta;
type Story = StoryObj;

// Stories from InvalidTestCasesDashboard
export const InvalidNoteId: Story = {
  name: 'Invalid Note ID Format',
  args: INVALID_TEST_CASES.invalidNoteId.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.invalidNoteId.description,
      },
    },
  },
};

export const MalformedNoteId: Story = {
  name: 'Malformed Note ID',
  args: INVALID_TEST_CASES.malformedNoteId.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.malformedNoteId.description,
      },
    },
  },
};

export const EmptyNoteId: Story = {
  name: 'Empty Note ID',
  args: INVALID_TEST_CASES.emptyNoteId.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.emptyNoteId.description,
      },
    },
  },
};

export const NullNoteId: Story = {
  name: 'Null Note ID',
  args: INVALID_TEST_CASES.nullNoteId.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.nullNoteId.description,
      },
    },
  },
};

export const InvalidRelays: Story = {
  name: 'Invalid Relays',
  args: INVALID_TEST_CASES.invalidRelays.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.invalidRelays.description,
      },
    },
  },
};

export const NetworkTimeout: Story = {
  name: 'Network Timeout',
  args: INVALID_TEST_CASES.networkTimeout.args,
  parameters: {
    docs: {
      description: {
        story: INVALID_TEST_CASES.networkTimeout.description,
      },
    },
  },
};