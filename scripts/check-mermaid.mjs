// 記事内の ```mermaid ブロックを全部集め、ビルドと同じ mermaid で構文検査する。
// ビルド(rehype-mermaid)は 1 つ壊れているだけで全体が落ち、どの記事のどの図かも
// 分かりにくいので、先にここで記事名・行番号つきで弾く。
//
// 使い方: node scripts/check-mermaid.mjs [記事ファイル...]   (省略時は全記事)
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const blogDir = join(root, 'src/content/blog');
const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : readdirSync(blogDir).filter((f) => f.endsWith('.mdx')).map((f) => join(blogDir, f));

const blocks = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/^```mermaid\s*$/.test(lines[i])) continue;
    const start = i + 1;
    let j = start;
    while (j < lines.length && !/^```\s*$/.test(lines[j])) j++;
    blocks.push({ file: relative(root, file), line: start + 1, code: lines.slice(start, j).join('\n') });
    i = j;
  }
}

if (blocks.length === 0) {
  console.log('mermaid ブロックなし');
  process.exit(0);
}

// ESM 版は about:blank からの file:// import が CORS で塞がれるので単一ファイル版を使う
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ path: join(root, 'node_modules/mermaid/dist/mermaid.min.js') });
await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false }));

let failed = 0;
for (const b of blocks) {
  // parse だけでは通って render で落ちる図(erDiagram の一部など)があるので render まで行う
  const err = await page.evaluate(async (code) => {
    try {
      await window.mermaid.render(`m${Math.random().toString(36).slice(2)}`, code);
      return null;
    } catch (e) {
      return String(e?.message ?? e).split('\n').slice(0, 3).join(' ');
    }
  }, b.code);
  if (err) {
    failed++;
    console.log(`NG ${b.file}:${b.line}\n   ${err}`);
  }
}
await browser.close();

console.log(`${blocks.length} 図中 ${failed} 件 NG`);
process.exit(failed ? 1 : 0);
