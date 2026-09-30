// scripts/diagrams/<doc>/*.jsx を静的 SVG に書き出す。
//
//   node scripts/render-diagrams.mjs spiral-history
//
// 図は JSX で書いた SVG(データやレイアウトをコードで持つ)。ビルド時に React で
// 実行するのではなく、ここで一度だけ描画して src/assets/documents/<doc>/ に置く。
// 色は var(--cds-*) のまま残し、src/styles/starlight.css でテーマ変数に結ぶ
// (ダークモードでも読めるようにするため、色を焼き込まない)。
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const doc = process.argv[2];
if (!doc) {
  console.error('usage: node scripts/render-diagrams.mjs <doc>');
  process.exit(2);
}

const srcDir = join('scripts', 'diagrams', doc);
const outDir = join('src', 'assets', 'documents', doc);
// esbuild の出力を一時的に置く。react/jsx-runtime を node_modules から解決させるため
// リポジトリ内に置く
const tmpDir = join('scripts', 'diagrams', '.tmp');
await mkdir(outDir, { recursive: true });
await mkdir(tmpDir, { recursive: true });

const files = (await readdir(srcDir)).filter((f) => f.endsWith('.jsx')).sort();
for (const f of files) {
  const jsx = await readFile(join(srcDir, f), 'utf8');
  const { code } = await transform(jsx, { loader: 'jsx', jsx: 'automatic', format: 'esm' });
  const tmp = join(tmpDir, f.replace(/\.jsx$/, '.mjs'));
  await writeFile(tmp, code);
  const mod = await import(pathToFileURL(tmp).href);
  let svg = renderToStaticMarkup(createElement(mod.default));
  // React が付ける属性を落とし、単体で開けるように名前空間を足す
  svg = svg
    .replace(/\sdata-claude-[a-z-]+="[^"]*"/g, '')
    .replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ');
  const out = join(outDir, basename(f, '.jsx') + '.svg');
  await writeFile(out, svg + '\n');
  console.log(`${f} -> ${out} (${(svg.length / 1024).toFixed(1)} KB)`);
}
await rm(tmpDir, { recursive: true, force: true });
