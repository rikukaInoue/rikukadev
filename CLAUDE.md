# Project: rikukadev

Astro v6 + MDX で構築されたテックブログ (rikuka.dev)

## Build & Test

- `npm run dev` - 開発サーバー
- `npm run build` - 本番ビルド（dist/ に出力）
- `npm run preview` - ビルド後プレビュー

## Blog Post Format

記事は `src/content/blog/*.mdx` に配置する。frontmatter は以下の4フィールド:

```yaml
---
title: "記事タイトル"
date: YYYY-MM-DD
tags: ["tag1", "tag2"]
description: "記事の説明"
---
```

## Critical Rules

- .env ファイルは絶対に読み書きしない
- rm -rf は使わない
- git push --force は使わない
- 既存記事の内容を勝手に変更しない

## Task Execution Protocol

1. 各ステップ完了後にテストを実行して確認する
2. コンパクションが起きたら、まず CLAUDE.md と現在のタスク計画を再読する
3. 不明点がある場合は推測せず停止する
4. 大きな変更は小さなコミット単位に分割する

## Commit Rules

- 意味のある単位で適度にコミットする。一度に大量の変更を溜め込まない
- 目安: 1 機能・1 修正・1 リファクタリングにつき 1 コミット
- テストが通る状態でのみコミットする。壊れた状態でコミットしない
- コミットメッセージは変更の「なぜ」を書く（「何を」は diff を見ればわかる）
- 長時間作業では、30 分に 1 回はコミットできる粒度で進める。コミットはセーブポイント

## Long Session Rules

- 作業を急いで終わらせようとしないこと。品質が最優先
- 不確かな場合はテストを書いて検証する
- 長時間の作業では適度にコミットして進捗を保全する。コンパクションやクラッシュで作業が失われるリスクを減らす
