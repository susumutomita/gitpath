# GitPath Backend

Express + TypeScript で構築された GitPath の API サーバー。

## API エンドポイント

### 認証 (Auth)

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| POST | `/api/auth/signup` | - | メール/Google でサインアップ |
| POST | `/api/auth/login` | - | ログイン |
| POST | `/api/auth/refresh` | - | アクセストークン更新 |

### セッション管理

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| POST | `/api/sessions` | 要 | 新規学習セッション作成 |
| GET | `/api/sessions/:sessionId` | 要 | セッション状態取得 |
| PATCH | `/api/sessions/:sessionId/step` | 要 | 現在ステップ更新 |

### ヒアリング

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| POST | `/api/hearing/start` | 要 | ヒアリングセッション開始 |
| POST | `/api/hearing/:hearingSessionId/answer` | 要 | 回答送信・次の質問取得 |
| GET | `/api/hearing/:hearingSessionId/previous` | 要 | 過去のヒアリング回答取得 |

### AI

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| POST | `/api/ai/explain` | 要 | AI によるステップ説明文生成 |
| POST | `/api/ai/generate-yaml` | 要 | GitHub Actions YAML 自動生成 |

### GitHub OAuth

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| POST | `/api/github/oauth/start` | 要 | OAuth フロー開始 (認証 URL 発行) |
| POST | `/api/github/oauth/callback` | - | OAuth コールバック処理 |

### マイルストーン

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| POST | `/api/milestones/:milestoneId/verify` | 要 | マイルストーン達成を GitHub API で検証 |
| GET | `/api/milestones/session/:sessionId` | 要 | セッションの全マイルストーン状況取得 |

### ターミナル

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| POST | `/api/terminal/sessions` | 要 | 仮想ターミナルセッション作成 (node-pty) |
| DELETE | `/api/terminal/sessions/:terminalSessionId` | 要 | ターミナルセッション終了 |

WebSocket エンドポイント: `ws://localhost:3001` (ターミナル I/O)

### サンドボックス

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| POST | `/api/sandbox/reset` | 要 | サンドボックス環境リセット |
| POST | `/api/sandbox/events` | 要 | 操作イベントログ保存 |
| POST | `/api/sandbox/understanding` | 要 | Git 理解確認の回答保存 |

### コマンド

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| POST | `/api/commands/validate` | 要 | 危険コマンドの事前検証 |
| POST | `/api/commands/errors` | 要 | コマンドエラーログ保存 |

### 達成証明

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| POST | `/api/certificates` | 要 | 達成証明カード生成 |
| GET | `/api/certificates/:certificateId` | - | 達成証明カード公開表示 |

### ヘルスチェック

| メソッド | パス | 認証 | 説明 |
|---------|------|:----:|------|
| GET | `/api/health` | - | サーバー稼働状況確認 |

## 環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATABASE_URL` | PostgreSQL 接続文字列 | `postgresql://gitpath:gitpath@localhost:5433/gitpath` |
| `REDIS_URL` | Redis 接続文字列 | `redis://localhost:6379` |
| `OPENAI_API_KEY` | OpenAI API キー | `sk-...` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App のクライアント ID | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App のクライアントシークレット | - |
| `JWT_SECRET` | JWT 署名用シークレットキー | - |
| `ENCRYPTION_KEY` | GitHub トークン暗号化キー (AES-256-GCM) | - |
| `NEXT_PUBLIC_API_URL` | フロントエンドからの API ベース URL | `http://localhost:3001` |
| `PORT` | サーバーポート番号 | `3001` |

## データベーススキーマ

主要テーブル:

| テーブル | 説明 |
|---------|------|
| `users` | ユーザーアカウント (メール/Google 認証) |
| `refresh_tokens` | リフレッシュトークン |
| `github_credentials` | GitHub OAuth トークン (AES-256-GCM 暗号化) |
| `learning_sessions` | 学習セッション (状態・進捗・経過時間) |
| `hearing_sessions` | ヒアリングセッション |
| `hearing_answers` | ヒアリング回答 (最大 5 問) |
| `user_level_profiles` | AI 推定レベル・カリキュラム |
| `milestone_definitions` | マイルストーン定義マスター (5 件) |
| `user_milestones` | ユーザーのマイルストーン達成状況 |
| `terminal_sessions` | 仮想ターミナルセッション |
| `command_logs` | コマンド実行ログ |
| `ai_explanation_logs` | AI 説明生成ログ |
| `sandbox_events` | サンドボックス操作イベント |
| `git_understanding_responses` | Git 理解確認回答 |
| `certificates` | 達成証明カード |
| `device_conflict_logs` | デバイス競合ログ |

## Prisma コマンド

```bash
# マイグレーション作成・実行
npx prisma migrate dev --name <migration_name>

# マスターデータ投入
npx prisma db seed

# Prisma Studio (DB ブラウザ)
npx prisma studio

# クライアント再生成
npx prisma generate

# マイグレーションリセット
npx prisma migrate reset
```

## テスト

```bash
# テスト実行
npm test

# ウォッチモード
npm run test:watch
```

テストフレームワーク: [Vitest](https://vitest.dev/)
