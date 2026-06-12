# トレーニングハブ

マッチョ化（2026年9月の旅行まで）とサブ3（2027年大阪マラソン）を1本で管理する個人用 PWA。
ローカル完結・オフライン動作・外部送信なし。

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
- **カレンダー**: 活動の色分け表示・週間走行距離・日タップで編集
- **設定**: 週間スケジュール / メニュー / 目標 / イベント / JSON入出力 / テーマ

Phase 2（可視化・写真ログ）、Phase 3（ラン計画エンジン）は `REQUIREMENTS.md` を参照。

## データ

`localStorage`（`th:logs` / `th:menus` / `th:settings`）に即時保存。
設定 → バックアップ から JSON エクスポート / インポートが可能。端末移行やバックアップに使用。
