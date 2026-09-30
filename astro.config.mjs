// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import rehypeMermaid from 'rehype-mermaid';
import rehypeSanitizeInlineStyles from './src/plugins/rehype-sanitize-inline-styles.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://rikuka.dev',
  integrations: [react(), mdx(), sitemap({ filter: (page) => !page.includes('/404') })],
  markdown: {
    syntaxHighlight: {
      type: 'shiki',
      excludeLangs: ['mermaid'],
    },
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
    rehypePlugins: [
      [rehypeMermaid, { strategy: 'inline-svg' }],
      // mermaid(erDiagram)が吐く壊れた style="undefined;;;undefined" を落とす。
      // 無いと MDX 変換がビルドごと失敗する。src/plugins/ 参照
      rehypeSanitizeInlineStyles,
    ],
  },
});
