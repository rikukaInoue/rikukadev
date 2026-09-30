import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { getPublishedAt } from '../lib/publish-date';

export async function GET(context) {
  const posts = (await getCollection('blog'))
    .map((post) => ({ post, publishedAt: getPublishedAt(post) }))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  return rss({
    title: 'rikuka.dev',
    description: 'rikukaの個人テックブログ。AWS・認証認可・インフラ設計などの技術記事を書いています。',
    site: context.site,
    items: posts.map(({ post, publishedAt }) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: publishedAt,
      link: `/blog/${post.id}/`,
    })),
    customData: '<language>ja</language>',
  });
}
