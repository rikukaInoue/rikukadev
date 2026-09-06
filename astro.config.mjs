// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import rehypeMermaid from 'rehype-mermaid';

// https://astro.build/config
export default defineConfig({
  site: 'https://rikuka.dev',
  integrations: [react(), mdx(), sitemap({ filter: (page) => !page.includes('/404') })],
  markdown: {
    syntaxHighlight: {
      type: 'shiki',
      excludeLangs: ['mermaid'],
    },
    rehypePlugins: [
      [rehypeMermaid, { strategy: 'inline-svg' }],
    ],
  },
});
