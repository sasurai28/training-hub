# トレーニングハブ

マッチョ化（2026年9月の旅行まで）とサブ3（2027年大阪マラソン）を1本で管理する個人用 PWA。
ローカル完結・オフライン動作。記録は端末内（localStorage）のみに保存します。

> **外部送信について**: 既定では一切の外部送信を行いません。唯一の例外が任意機能の
> **AIコーチ**で、設定で Anthropic APIキーを登録した場合に限り、アドバイス生成のため
> 記録の要約を Anthropic の API に送信します（キー未登録なら送信は発生しません）。

## 開発

```bash
npm install
npm run icons   # public/ にPWAアイコンを生成（初回のみ。デザイン変更時も）
npm run dev     # http://localhost:5173/
npm run build   # 型チェック + 本番ビルド（dist/）
npm run preview # ビルド成果物をローカル確認
```

## スマホへの導入

1. `npm run build` の成果物（`dist/`）を配信、または GitHub Pages へデプロイ
2. iOS Safari / Android Chrome で開く
3. 「ホーム画面に追加」でアプリとして全画面起動

## GitHub Pages へのデプロイ

1. GitHub に `training-hub` という名前でリポジトリを作成し push
2. リポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** に設定
3. `main` への push で `.github/workflows/deploy.yml` が自動ビルド・公開
4. 公開 URL は `https://<ユーザー名>.github.io/training-hub/`

> リポジトリ名を `training-hub` 以外にする場合は `vite.config.ts` の `REPO_BASE` を合わせて変更すること。

## 機能（Phase 1）

- **今日**: 今日のメニュー / イベントカウントダウン / クイック記録 / 週次目標の進捗
- **記録**: 筋トレ（前回値プリセット・前回超え✓演出）/ ラン（ペース自動計算）/ ピックルボール / 体重・タンパク質
- **カレンダー**: 活動の色分け表示・週間走行距離・日タップで編集・ピックル参加/強制休息の設定
- **分析**: 体重推移（目標ライン付き）/ 週間走行距離（直近8週・目標比較）/ 種目別トップ重量の推移 / サマリータイル（Phase 2 の可視化）
- **設定**: 週間スケジュール / メニュー / 目標 / イベント / JSON入出力 / テーマ / AIコーチ（APIキー）
- **AIコーチ（任意）**: 「今日」画面で、直近の記録・週次目標・イベントを要約して Claude に渡し、今週のアドバイスを生成（要 Anthropic APIキー）

### AIコーチの使い方

1. [console.anthropic.com](https://console.anthropic.com) で APIキーを取得
2. 設定 → AIコーチ にキーを貼り付け（端末内のみに保存。JSONエクスポートには含まれません）
3. 「今日」画面の AIコーチカードで「今週のアドバイス」をタップ

> キーはブラウザの localStorage に平文で保存され、API はブラウザから直接呼び出します
> （個人端末で自分のキーを使う前提）。共用端末では使用を避けてください。利用に応じて
> Anthropic の API 料金が発生します。モデルは `claude-opus-4-8` を使用します。

Phase 2（可視化・写真ログ）、Phase 3（ラン計画エンジン）は `REQUIREMENTS.md` を参照。

## データ

`localStorage`（`th:logs` / `th:menus` / `th:settings`）に即時保存。
設定 → バックアップ から JSON エクスポート / インポートが可能。端末移行やバックアップに使用。
