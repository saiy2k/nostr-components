import React from 'react';
import type { StoryObj } from '@storybook/web-components-vite';
import { generateCode, generateArgTypes } from './testing-utils.ts';

const meta = {
  title: 'NostrProfileBadge/Testing',
  tags: ['test', 'dev'],
  render: args => generateCode(args),
  argTypes: generateArgTypes(),
  args: { onClick: () => {} },
  parameters: {
    docs: { disable: true },
    test: {
      enabled: true,
      a11y: {
        element: 'nostr-profile-badge',
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

// ====================================
// COMPREHENSIVE TESTING DASHBOARDS
// ====================================
// Individual test stories have been moved to separate files:
// - NostrProfileBadge.testing.valid.stories.tsx (for valid cases)
// - NostrProfileBadge.testing.invalid.stories.tsx (for invalid cases)

export const ValidCasesDashboard: Story = {
  name: 'Valid Cases Dashboard',
  tags: ['test', 'dashboard', 'valid'],
  render: () => `
    <div style="padding: 20px; background: #f5f5f5;">

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="margin: 0; color: #16a34a;">✅ Valid Cases Dashboard</h2>
        <p style="margin: 5px 0 0 0; color: #666;">Test cases showing proper component behavior with valid inputs</p>
      </div>

      <!-- Valid Cases Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
        
        <!-- Valid NPub -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
          <h4 style="margin: 0 0 10px 0; color: #16a34a;">Valid NPub</h4>
          <nostr-profile-badge npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"></nostr-profile-badge>
        </div>

        <!-- Dark Theme -->
        <div style="background: #1f2937; padding: 15px; border-radius: 8px; border-left: 4px solid #6b7280;">
          <h4 style="margin: 0 0 10px 0; color: #e5e7eb;">Dark Theme</h4>
          <nostr-profile-badge npub="npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx" theme="dark"></nostr-profile-badge>
        </div>

        <!-- Show NPub Feature -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
          <h4 style="margin: 0 0 10px 0; color: #16a34a;">Show NPub Feature</h4>
          <nostr-profile-badge npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6" show-npub="true"></nostr-profile-badge>
        </div>

        <!-- Show Follow Button -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
          <h4 style="margin: 0 0 10px 0; color: #16a34a;">Show Follow Button</h4>
          <nostr-profile-badge npub="npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx" show-follow="true"></nostr-profile-badge>
        </div>

        <!-- All Features -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
          <h4 style="margin: 0 0 10px 0; color: #16a34a;">All Features</h4>
          <nostr-profile-badge npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6" show-npub="true" show-follow="true"></nostr-profile-badge>
        </div>

        <!-- Raw Pubkey -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
          <h4 style="margin: 0 0 10px 0; color: #16a34a;">Raw Pubkey</h4>
          <nostr-profile-badge pubkey="1989034e56b8f606c724f45a12ce84a11841621aaf7182a1f6564380b9c4276b"></nostr-profile-badge>
        </div>

        <!-- Narrow Width -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
          <h4 style="margin: 0 0 10px 0; color: #16a34a;">Narrow Width</h4>
          <div style="width: 200px;">
            <nostr-profile-badge npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"></nostr-profile-badge>
          </div>
        </div>

      </div>

    </div>
  `,
  parameters: {
    docs: {
      description: {
        story: 'Dashboard showcasing all valid input scenarios and proper component behavior.',
      },
    },
    layout: 'fullscreen',
  },
};

export const InvalidCasesDashboard: Story = {
  name: 'Invalid Cases Dashboard',
  tags: ['test', 'dashboard', 'invalid'],
  render: () => `
    <div style="padding: 20px; background: #f5f5f5;">

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="margin: 0; color: #dc2626;">❌ Invalid Cases Dashboard</h2>
        <p style="margin: 5px 0 0 0; color: #666;">Test cases showing error handling and component resilience with invalid inputs</p>
      </div>

      <!-- Invalid Cases Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
        
        <!-- Invalid NPub -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
          <h4 style="margin: 0 0 10px 0; color: #dc2626;">Invalid NPub Format</h4>
          <nostr-profile-badge npub="invalid-npub-format"></nostr-profile-badge>
        </div>

        <!-- Empty Input -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
          <h4 style="margin: 0 0 10px 0; color: #dc2626;">Empty Input</h4>
          <nostr-profile-badge npub=""></nostr-profile-badge>
        </div>

        <!-- Invalid NIP-05 -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
          <h4 style="margin: 0 0 10px 0; color: #dc2626;">Invalid NIP-05 Format</h4>
          <nostr-profile-badge nip05="malformed@invalid@domain.com"></nostr-profile-badge>
        </div>

        <!-- Invalid Pubkey -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
          <h4 style="margin: 0 0 10px 0; color: #dc2626;">Invalid Pubkey Format</h4>
          <nostr-profile-badge pubkey="invalid-pubkey-format-xyz123"></nostr-profile-badge>
        </div>

        <!-- Invalid Theme -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
          <h4 style="margin: 0 0 10px 0; color: #dc2626;">Invalid Theme Value</h4>
          <nostr-profile-badge npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6" theme="invalid-theme"></nostr-profile-badge>
        </div>

        <!-- Network Failure -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
          <h4 style="margin: 0 0 10px 0; color: #dc2626;">Network Failure</h4>
          <nostr-profile-badge npub="npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6" relays="wss://invalid-relay.com"></nostr-profile-badge>
        </div>

      </div>

    </div>
  `,
  parameters: {
    docs: {
      description: {
        story: 'Dashboard showcasing error handling and component behavior with invalid inputs.',
      },
    },
    layout: 'fullscreen',
  },
};