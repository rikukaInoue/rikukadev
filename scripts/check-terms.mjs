// 使わない言い換えの検査と自動修正。
// ルールは src/content/blog/standard-terms.mdx の「使わない言い換えの一覧」の表から読む
// (表を正とし、ここにルールを二重に持たない)。
//
//   node scripts/check-terms.mjs --staged [--fix]   ステージした変更の追加行を検査(pre-commit)
//   node scripts/check-terms.mjs --diff <a>..<b>    コミット範囲の追加行を検査(CI)
//   node scripts/check-terms.mjs <file>...          ファイル全体を検査
//
// 「代わりに」が 1 つに決まる行だけ --fix で置き換える。文脈で変わるもの(、区切りで
// 複数あるもの)は候補を出して失敗にする。既存記事の古い表現で止まらないように、
// --staged と --diff は追加・変更した行だけを見る。
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const RULES_FILE = "src/content/blog/standard-terms.mdx";
const TARGET = /^src\/content\/(blog|docs)\/.*\.mdx?$/;

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

// --- ルールを表から読む ----------------------------------------------------
function loadRules() {
  const src = readFileSync(RULES_FILE, "utf8");
  const start = src.indexOf("## 使わない言い換えの一覧");
  if (start < 0) throw new Error(`${RULES_FILE} に「使わない言い換えの一覧」が無い`);
  const section = src.slice(start).split(/\n## /)[0];
  const rules = [];
  for (const line of section.split("\n")) {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3 || cells[0] === "使わない" || /^-+$/.test(cells[0])) continue;
    const instead = cells[1];
    // 「置く・当てる・見せる」のように並べた語は 1 語ずつに分ける。カッコ内は用例なので除く
    const words = cells[0].replace(/（[^）]*）|\([^)]*\)/g, "");
    for (const word of words.split(/[、・]/).map((w) => w.trim()).filter(Boolean)) {
      const single = !/[、・,]/.test(instead);
      rules.push({ word, instead, fix: single ? instead : null, why: cells[2] });
    }
  }
  if (rules.length === 0) throw new Error("ルールを 1 件も読めなかった(表の形が変わった)");
  return rules;
}

// --- 検査対象の行 ----------------------------------------------------------
// コードブロック(mermaid 以外)とインラインコードは対象外。mermaid の図のラベルは本文と同じ扱い
function proseMask(lines) {
  const mask = [];
  let fence = null;
  for (const line of lines) {
    const m = line.match(/^\s*(```+|~~~+)\s*([\w-]*)/);
    if (m) {
      if (!fence) fence = { mark: m[1], lang: m[2] };
      else if (line.trim().startsWith(fence.mark)) {
        mask.push(false);
        fence = null;
        continue;
      }
      mask.push(false);
      continue;
    }
    mask.push(!fence || fence.lang === "mermaid");
  }
  return mask;
}

// 英字の語に置き換えるときは、隣が日本語なら半角スペースを挟む(「promotion gate を通す」)
const isWide = (ch) => ch !== undefined && /[^\x00-\x7F]/.test(ch) && !/[、。（）「」・]/.test(ch);
function replaceSpaced(text, word, fix) {
  const ascii = /^[\x00-\x7F]+$/.test(fix);
  let out = "";
  let i = 0;
  for (let j = text.indexOf(word); j >= 0; j = text.indexOf(word, i)) {
    const before = text[j - 1];
    const after = text[j + word.length];
    out += text.slice(i, j);
    out += (ascii && isWide(before) ? " " : "") + fix + (ascii && isWide(after) ? " " : "");
    i = j + word.length;
  }
  return out + text.slice(i);
}

const stripInlineCode =(line) => line.replace(/`[^`]*`/g, (m) => " ".repeat(m.length));

// 追加・変更した行番号(新しい側)。range が null ならステージした差分
function addedLines(file, range) {
  const args = range ? ["diff", "-U0", range, "--", file] : ["diff", "--cached", "-U0", "--", file];
  const out = git(...args);
  const set = new Set();
  for (const m of out.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const startLine = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    for (let i = 0; i < count; i++) set.add(startLine + i);
  }
  return set;
}

function check(file, text, only, rules, fix) {
  const lines = text.split("\n");
  const mask = proseMask(lines);
  const problems = [];
  let fixed = 0;
  lines.forEach((line, i) => {
    const no = i + 1;
    if (!mask[i] || (only && !only.has(no))) return;
    for (const r of rules) {
      if (!stripInlineCode(lines[i]).includes(r.word)) continue;
      if (fix && r.fix) {
        // インラインコードの中は置き換えない
        lines[i] = lines[i].replace(/(`[^`]*`)|([^`]+)/g, (m, code, prose) =>
          code ?? replaceSpaced(prose, r.word, r.fix),
        );
        fixed++;
      } else {
        problems.push({ file, no, word: r.word, instead: r.instead, why: r.why, text: line.trim() });
      }
    }
  });
  return { problems, fixed, text: lines.join("\n") };
}

// --- main ----------------------------------------------------------------
const args = process.argv.slice(2);
const fix = args.includes("--fix");
const staged = args.includes("--staged");
const diffIdx = args.indexOf("--diff");
const range = diffIdx >= 0 ? args[diffIdx + 1] : null;
const rules = loadRules();

let files;
if (staged) {
  files = git("diff", "--cached", "--name-only", "--diff-filter=AM").split("\n");
} else if (range) {
  files = git("diff", "--name-only", "--diff-filter=AM", range).split("\n");
} else {
  files = args.filter((a) => !a.startsWith("--"));
}
files = files.filter((f) => TARGET.test(f) && f !== RULES_FILE);

const unstaged = staged ? new Set(git("diff", "--name-only").split("\n")) : new Set();
let problems = [];
let fixedTotal = 0;

for (const file of files) {
  const only = staged || range ? addedLines(file, range) : null;
  if (only && only.size === 0) continue;
  // ステージしていない変更があるファイルは、作業ツリーとステージの行がずれるので直さない
  const canFix = fix && staged && !unstaged.has(file);
  const text = staged ? git("show", `:${file}`) : range ? git("show", `${range.split("..")[1]}:${file}`) : readFileSync(file, "utf8");
  const r = check(file, text, only, rules, canFix);
  if (r.fixed > 0) {
    writeFileSync(file, r.text);
    git("add", "--", file);
    fixedTotal += r.fixed;
    console.log(`fixed ${file}: ${r.fixed} 箇所を置き換えてステージし直した`);
  }
  problems = problems.concat(r.problems);
}

if (problems.length > 0) {
  for (const p of problems) {
    console.error(`NG ${p.file}:${p.no} 「${p.word}」→ ${p.instead}（${p.why}）\n   ${p.text}`);
  }
  console.error(`\n使わない言い換えが ${problems.length} 件ある。上の候補から文脈に合う語に直す(ルール: ${RULES_FILE})`);
  process.exit(1);
}
if (fixedTotal === 0) console.log(`terms ok (${files.length} files)`);
