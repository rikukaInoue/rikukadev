// 記事タイトルの長さ規約(全角 1 字・半角 0.5 字換算)。
// 検査スクリプト(check-title-length.mjs)と content collections の schema
// (src/content.config.ts)の両方がこれを使う。上限を変えるときはここだけ直す。
export const TITLE_LIMIT = 40;

export const titleWidth = (s) =>
  [...s].reduce((n, ch) => n + (ch.charCodeAt(0) <= 0x7f ? 0.5 : 1), 0);
