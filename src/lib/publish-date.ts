import { execFileSync } from 'node:child_process';

// 公開日時 = 記事ファイルが main に入ったコミット(PR ならマージコミット)の時刻。
// frontmatter の date は日付しか持たず、同じ日に複数本公開すると順序が付かないため、
// 表示・並び順・RSS・JSON-LD はすべてこの値を使う。
// git 履歴に無い記事(コミット前のローカル執筆中など)は frontmatter の date に落とす。

const BLOG_DIR = 'src/content/blog';

let cache: Map<string, Date> | null = null;

function loadFromGit(): Map<string, Date> {
  if (cache) return cache;
  cache = new Map();
  let out = '';
  try {
    out = execFileSync(
      'git',
      [
        'log',
        '--first-parent',
        '--diff-filter=A',
        '--name-only',
        '--format=%x00%cI',
        '--',
        BLOG_DIR,
      ],
      { encoding: 'utf8', cwd: process.cwd() },
    );
  } catch {
    // git が無い / shallow clone で履歴が無い等。fallback に任せる
    return cache;
  }
  // 出力は新しいコミットから順。\0 の直後が ISO 時刻、続く行が追加されたファイル。
  // 古いコミットほど後に来るので、後勝ちで上書きすれば「最初に追加された時刻」になる。
  for (const block of out.split('\0').slice(1)) {
    const [iso, ...files] = block.split('\n');
    const date = new Date(iso.trim());
    if (Number.isNaN(date.getTime())) continue;
    for (const f of files) {
      const file = f.trim();
      if (file) cache.set(file, date);
    }
  }
  return cache;
}

type Entry = { filePath?: string; data: { date: Date } };

export function getPublishedAt(entry: Entry): Date {
  const map = loadFromGit();
  const fromGit = entry.filePath ? map.get(entry.filePath) : undefined;
  return fromGit ?? entry.data.date;
}

const TZ = 'Asia/Tokyo';

// 例: "Sep 30, 2026 · 15:45 JST"
export function formatPublishedAt(date: Date): string {
  const day = date.toLocaleDateString('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} · ${time} JST`;
}

// 絞り込み用の月キー。例: "2026-09"
export function monthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
}

// 例: "2026年9月"
export function formatMonth(key: string): string {
  const [y, m] = key.split('-');
  return `${y}年${Number(m)}月`;
}
