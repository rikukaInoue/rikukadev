import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { TITLE_LIMIT, titleWidth } from '../scripts/title-rule.mjs';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
  schema: z.object({
    // 長さの規約は scripts/title-rule.mjs(CI の検査と同じ規則。全角 1・半角 0.5 換算)
    title: z.string().refine((t) => titleWidth(t) <= TITLE_LIMIT, {
      message: `タイトルが長すぎる(上限 ${TITLE_LIMIT} 字。全角 1・半角 0.5 換算。字数は node scripts/check-title-length.mjs で出る)`,
    }),
    date: z.coerce.date(),
    tags: z.array(z.string()),
    description: z.string(),
  }),
});

// docs は Starlight の読み物(/documents/...)。src/content/docs/ 配下がそのまま URL になる
const docs = defineCollection({ loader: docsLoader(), schema: docsSchema() });

export const collections = { blog, docs };
