import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const fontData = fs.readFileSync(
  path.resolve('src/assets/fonts/NotoSansJP-Bold.ttf')
);

interface OgImageInput {
  title: string;
  date?: string;
  tags?: string[];
}

export async function renderOgImage({ title, date, tags }: OgImageInput): Promise<Buffer> {
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: '#0a0a0a',
          color: '#f0f0f0',
          fontFamily: 'Noto Sans JP',
          borderBottom: '10px solid #93928b',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { display: 'flex', fontSize: 32, color: '#93928b', letterSpacing: '0.08em' },
              children: 'rikuka.dev',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                fontSize: title.length > 40 ? 52 : 62,
                fontWeight: 700,
                lineHeight: 1.4,
              },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 26,
                color: '#888',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', gap: '16px' },
                    children: (tags ?? []).slice(0, 4).map((tag) => ({
                      type: 'div',
                      props: { children: `#${tag}` },
                    })),
                  },
                },
                { type: 'div', props: { children: date ?? '' } },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Noto Sans JP', data: fontData, weight: 700, style: 'normal' }],
    }
  );

  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
