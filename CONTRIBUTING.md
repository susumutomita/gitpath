# コントリビューションガイド

GitPath への貢献に興味を持っていただきありがとうございます。このドキュメントでは、開発ワークフローとルールについて説明します。

## 開発環境セットアップ

1. リポジトリをフォーク & クローン
2. 依存パッケージをインストール: `npm run install:all`
3. Docker でDB を起動: `npm run docker:up`
4. 環境変数を設定: `cp .env.example backend/.env` して各値を記入
5. DB マイグレーション: `cd backend && npx prisma migrate dev`
6. シードデータ投入: `npx prisma db seed`
7. 開発サーバー起動: `npm run dev:backend` と `npm run dev:frontend`

## 開発ワークフロー

1. `main` ブランチから作業ブランチを作成
2. 変更を実装
3. テストを追加・実行して通ることを確認
4. コミットして Push
5. Pull Request を作成

## ブランチ命名規則

```
feat/<機能名>        # 新機能
fix/<バグ説明>       # バグ修正
refactor/<対象>      # リファクタリング
docs/<対象>          # ドキュメント
test/<対象>          # テスト追加・修正
chore/<対象>         # その他 (依存更新、設定変更等)
```

例:
- `feat/hearing-chat-ui`
- `fix/websocket-reconnect`
- `docs/api-reference`

## コミットメッセージ形式

[Conventional Commits](https://www.conventionalcommits.org/) に従います。

```
<type>(<scope>): <description>

[optional body]
```

type:
- `feat` -- 新機能
- `fix` -- バグ修正
- `refactor` -- リファクタリング
- `docs` -- ドキュメント
- `test` -- テスト
- `chore` -- その他

scope (任意): `backend`, `frontend`, `shared`, `db`

例:
```
feat(backend): ヒアリング回答 API を実装
fix(frontend): タイマーがセッション復元時にリセットされる問題を修正
docs: README にクイックスタートガイドを追加
```

## Pull Request テンプレート

PR を作成する際は以下の情報を含めてください:

```markdown
## 概要
変更内容の簡潔な説明

## 変更点
- 変更 1
- 変更 2

## テスト
- [ ] 既存テストが通ること
- [ ] 新規テストを追加した (該当する場合)
- [ ] ローカルで動作確認済み

## 関連 Issue
#issue-number
```

## テスト要件

- バックエンドの変更: Vitest でユニットテストを追加
- フロントエンドの変更: 該当する場合 Playwright で E2E テストを追加
- テストコマンド:
  - バックエンド: `cd backend && npm test`
  - E2E: `cd frontend && npm run test:e2e`

## コードスタイル

- TypeScript を使用 (型定義を省略しない)
- ESLint の設定に従う: `cd frontend && npm run lint`
- Tailwind CSS でスタイリング (インラインスタイル不可)
- shadcn/ui コンポーネントを優先的に使用

## 実装ルール (PRD 準拠)

- モックデータ、ハードコード配列、スタブ API での実装は完了とみなさない
- 全データは実際の DB/API から取得・保存すること
- バックエンド API 未実装の場合、UI より先にバックエンドの最小実装を作る
- 未実装機能は UI 上で明示的に「未実装」と表示する
