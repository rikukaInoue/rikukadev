import type { APIRoute } from 'astro';
import { renderOgImage } from '../lib/og-image';

export const GET: APIRoute = async () => {
  const png = await renderOgImage({
    title: 'rikuka.dev',
    tags: ['AWS', '認証認可', 'インフラ設計'],
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
