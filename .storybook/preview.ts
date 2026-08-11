import type { Preview } from '@storybook/web-components-vite';
import { assetUrl, getStorybookBundleMode } from '../stories/common/bundle';

function loadStylesheet(href: string): Promise<void> {
  const existing = document.querySelector<HTMLLinkElement>('link[data-nc-bundle="themes"]');
  if (existing) {
    const current = existing.getAttribute('href') || '';
    if (current === href || existing.href.endsWith(href) || existing.href === href) {
      return Promise.resolve();
    }
    existing.remove();
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.ncBundle = 'themes';
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
    document.head.appendChild(link);
  });
}

function loadModuleScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>('script[data-nc-bundle="components"]');
  if (existing) {
    const current = existing.getAttribute('src') || '';
    if (current === src || existing.src.endsWith(src) || existing.src === src) {
      return Promise.resolve();
    }
    existing.remove();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = src;
    script.dataset.ncBundle = 'components';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load module: ${src}`));
    document.head.appendChild(script);
  });
}

await loadStylesheet(assetUrl('themes.css'));
await loadModuleScript(assetUrl('nostr-components.es.js'));

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      brandTitle: `Nostr Components (${getStorybookBundleMode()})`,
      brandUrl: 'https://nostr-components.web.app/',
    },
  },
  decorators: [
    (story, context) => {
      // Check if story has dark theme
      const isDarkTheme = context.args?.['data-theme'] === 'dark';
      
      // Apply background to body
      if (isDarkTheme) {
        document.body.style.backgroundColor = '#000000';
      } else {
        document.body.style.backgroundColor = '';
      }
      
      return story();
    },
  ],
};

export default preview;
