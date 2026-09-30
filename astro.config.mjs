// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import rehypeMermaid from 'rehype-mermaid';
import rehypeSanitizeInlineStyles from './src/plugins/rehype-sanitize-inline-styles.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://rikuka.dev',
  integrations: [
    // Starlight は /documents 配下の読み物(書籍形式)。MDX 統合は Starlight が
    // 内部で追加するので、ここで mdx() を重ねて登録しない(二重登録で落ちる)。
    // blog コレクションの MDX もその統合で処理される
    starlight({
      title: 'rikuka.dev',
      defaultLocale: 'root',
      locales: { root: { label: '日本語', lang: 'ja' } },
      customCss: ['./src/styles/starlight.css'],
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/rikukaInoue' }],
      sidebar: [
        { label: 'Documents', link: '/documents/' },
        {
          label: '螺旋の歴史',
          items: [{ autogenerate: { directory: 'documents/spiral-history' } }],
        },
      ],
      pagefind: true,
    }),
    react(),
    sitemap({ filter: (page) => !page.includes('/404') }),
  ],
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
