import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@chromatic-com/storybook',
    '@storybook/addon-docs',
  ],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
  docs: {
    autodocs: true,
  },
  // Add this line to serve the 'dist' directory
  staticDirs: ['../dist'],
};
export default config;
