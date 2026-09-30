// 記事タイトルの長さ検査。全角 1 字・半角 0.5 字換算で上限は scripts/title-rule.mjs。
// 全記事に適用(2026-09-12 に既存記事も含めて全タイトルを揃えた)。
// 上限は 20 字だったが、サービス名が長いものが収まらないため 32 字に緩めた
// (2026-09-24)。「技術名 + してみた。+ 核の一文」の形が 32 字に収まらないことが
// 増えたため 40 字に緩めた(2026-10-01)。対象は content collections の blog と
// docs(Starlight の Documents)の両方。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { TITLE_LIMIT, titleWidth } from "./title-rule.mjs";

const DIRS = ["src/content/blog", "src/content/docs"];

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.mdx?$/.test(f) ? [p] : [];
  });

let failed = false;
let checked = 0;
for (const file of DIRS.flatMap(walk)) {
  const fm = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/);
  // 引用符あり/なしの両方(Documents は引用符なしで書いている)
  const m = fm?.[1].match(/^title:\s*(?:"(.*)"|'(.*)'|(.*?))\s*$/m);
  const title = m && (m[1] ?? m[2] ?? m[3]);
  if (!title) continue;
  checked++;
  const w = titleWidth(title);
  if (w > TITLE_LIMIT) {
    console.error(`NG ${file}: タイトル ${w} 字(全角換算、上限 ${TITLE_LIMIT})\n   "${title}"`);
    failed = true;
  }
}
// 走査が空振りしたら検査は成立していない(fail closed)
if (checked === 0) {
  console.error("NG: タイトルを1件も読めなかった(対象ディレクトリか frontmatter の形が変わった)");
  process.exit(1);
}
if (failed) {
  console.error(`\nタイトルは ${TITLE_LIMIT} 字以内にする(全角 1 字・半角 0.5 字換算)`);
  process.exit(1);
}
console.log(`ok: 記事タイトルは規約内(${checked} 件を確認)`);
