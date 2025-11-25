# AI Experimental Lab

個人的なAI実験やプロジェクトを記録・公開するための静的ウェブサイトテンプレートです。
Markdown記法と画像表示に対応しています。

## 📂 フォルダ構成

```text
.
├── posts/           # 記事のMarkdownファイルを置く場所
│   └── _template.md # 記事作成用テンプレート
├── build.py         # MarkdownからJSを生成するスクリプト
├── index.html       # メインページ
├── style.css        # スタイル定義
├── script.js        # サイト動作ロジック
└── experiments.js   # [自動生成] 実験データ
```

## 🚀 使い方

### 1. 新しい実験の追加
1. `posts/` フォルダ内の `_template.md` をコピーして、新しい `.md` ファイルを作成します（例: `exp-007.md`）。
2. ファイル内の Frontmatter（`---` で囲まれた部分）と本文を編集します。

```markdown
---
id: exp-007
title: 新しい実験
date: 2025-11-24
tags: [LLM, Python]
image: https://...
summary: 記事の要約
links:
  - label: GitHub
    url: https://...
---

## 本文
ここはMarkdownで自由に記述できます。
```

### 2. サイトの更新
ターミナルで以下のコマンドを実行し、`experiments.js` を更新します。

```bash
python build.py
```

### 3. サイトの閲覧
`index.html` をブラウザで開いて確認します。

## 🌐 GitHub Pages での公開について

このサイトは **GitHub Pages** で正常に動作します。

### 仕組み
GitHub Pages は静的サイトホスティングサービスです。
`python build.py` を実行すると、Markdownの内容が `experiments.js` というJavaScriptファイルに変換（コンパイル）されます。
ブラウザはこの `experiments.js` を読み込んで表示するため、サーバー側でPythonが動く必要はありません。

### 推奨ワークフロー
1. 記事を書く (`posts/*.md`)
2. ビルドコマンドを実行 (`python build.py`) ※ここで `experiments.js` が更新されます
3. Gitでコミット & プッシュ (`git add .`, `git commit`, `git push`)
4. GitHub Pages が自動的に更新されます

> [!WARNING]
> **画像ファイル名についての注意**
> 画像のパスやファイル名に「日本語」や「スペース」が含まれていると、Webサーバー上で正しく表示されない場合があります。
> 画像ファイル名は **半角英数字**（例: `image01.png`）にし、パスの区切り文字は `/`（スラッシュ）を使用することを強く推奨します。

## 🛠️ 技術スタック
- **HTML5 / CSS3**
- **Vanilla JavaScript**
- **Python** (ビルドスクリプト)
- **marked.js** (Markdownレンダリング)
