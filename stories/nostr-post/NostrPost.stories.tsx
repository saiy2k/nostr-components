import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/web-components';
import { generateCode, generateCodeWithScript, getArgTypes } from './utils';
import { TEST_CASES } from './test-cases-valid';

const meta: Meta = {
  title: 'Post',
  tags: ['autodocs'],
  render: args => generateCode(args),
  argTypes: getArgTypes(),
  args: {},
  parameters: {
    docs: {
      description: {
        component: 'A web component that displays Nostr posts with content, metadata, and statistics. Supports note IDs, event IDs, and raw hex inputs.',
      },
      source: {
        transform: (code, storyContext) =>
          generateCodeWithScript(storyContext.args),
      },
      prepend: `
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@glidejs/glide/dist/css/glide.core.min.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@glidejs/glide/dist/css/glide.theme.min.css" />
      `,
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<any>;

export const Default: Story = {
  name: TEST_CASES.default.name,
  args: TEST_CASES.default.args,
};

export const DarkTheme: Story = {
  name: TEST_CASES.darkTheme.name,
  args: TEST_CASES.darkTheme.args,
};

export const EventId: Story = {
  name: TEST_CASES.eventId.name,
  args: TEST_CASES.eventId.args,
};

export const RawHex: Story = {
  name: TEST_CASES.rawHex.name,
  args: TEST_CASES.rawHex.args,
};

export const ShowStats: Story = {
  name: TEST_CASES.showStats.name,
  args: TEST_CASES.showStats.args,
};

// Content Type Stories
export const LongFormContent: Story = {
  name: '[Type] Long Form Content',
  args: TEST_CASES.longFormContent.args,
};

export const LongFormContent2: Story = {
  name: '[Type] Long Form Content 2',
  args: TEST_CASES.longFormContent2.args,
};

export const GifPost: Story = {
  name: '[Type] Animated GIF',
  args: TEST_CASES.gifPost.args,
};

export const TwoImagesPost: Story = {
  name: '[Type] 2 Images',
  args: TEST_CASES.twoImagesPost.args,
};

export const FourImagesPost: Story = {
  name: '[Type] 4 Images',
  args: TEST_CASES.fourImagesPost.args,
};

export const ImageAndLinkPost: Story = {
  name: '[Type] Image and Link',
  args: TEST_CASES.imageAndLinkPost.args,
};

export const VideoPost: Story = {
  name: '[Type] Video Content',
  args: TEST_CASES.videoPost.args,
};

export const TypeMentionPost: Story = {
  name: '[Type] Mention and Embed',
  args: TEST_CASES.mentionPost.args,
};

export const EmbeddedNoteWithVideoPost: Story = {
  name: '[Type] Embedded Note With Video',
  args: TEST_CASES.embeddedNoteWithVideoPost.args,
};

export const MentionAndVideoPost: Story = {
  name: '[Type] Mention and Video',
  args: TEST_CASES.mentionAndVideoPost.args,
};

export const EmojisPost: Story = {
  name: '[Type] Emojis',
  args: TEST_CASES.emojisPost.args,
};
