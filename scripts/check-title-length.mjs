// 記事タイトルの長さ検査。全角 1 字・半角 0.5 字換算で上限 20 字。
// 既存記事は対象外(CUTOFF 以降の date の記事にだけ適用する)。
import { readdirSync, readFileSync } from "node:fs";

const DIR = "src/content/blog";
const LIMIT = 20;
const CUTOFF = process.env.TITLE_RULE_CUTOFF || "2026-09-13";

const width = (s) =>
  [...s].reduce((n, ch) => n + (ch.charCodeAt(0) <= 0x7f ? 0.5 : 1), 0);

let failed = false;
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".mdx"))) {
  const src = readFileSync(`${DIR}/${f}`, "utf8");
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  const title = fm?.[1].match(/^title:\s*"(.*)"\s*$/m)?.[1];
  const date = fm?.[1].match(/^date:\s*(\S+)/m)?.[1];
  if (!title || !date || date < CUTOFF) continue;
  const w = width(title);
  if (w > LIMIT) {
    console.error(
      `NG ${f}: タイトル ${w} 字(全角換算、上限 ${LIMIT})\n   "${title}"`
    );
    failed = true;
  }
}
if (failed) {
  console.error(
    "\nタイトルは「なぜエラーが出て何が問題か」が分かる 20 字以内にする(半角は 0.5 字換算)"
  );
  process.exit(1);
}
console.log("ok: 記事タイトルは規約内");
