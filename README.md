# GitPath

非エンジニア向け Git/CI/CD 習得プラットフォーム -- AI による個別最適化ガイドで、GitHubアカウント作成から CI/CD 構築まで 30 分で完走。

## 特徴

- **AI パーソナライズ学習** -- ユーザーの職業・経験に合わせた説明を AI がリアルタイム生成
- **概念体感サンドボックス** -- 「バージョンが消える」失敗体験から Git の必要性を理解
- **ブラウザ内仮想ターミナル** -- 実際の Git コマンドを WebSocket 接続のシェルで実行
- **5 つのマイルストーン検証** -- GitHub API で実際の操作結果を自動検証
- **達成証明カード** -- 全マイルストーン完走後に共有可能な証明 URL を発行
- **セッション復元** -- 途中離脱しても次回ログイン時に続きから再開

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, xterm.js, Zustand |
| バックエンド | Node.js, Express, TypeScript, WebSocket (ws), node-pty, OpenAI API (GPT-4o), GitHub REST/GraphQL API |
| データベース | PostgreSQL 15, Redis 7 |
| テスト | Vitest (バックエンド), Playwright (E2E) |
| インフラ | Docker Compose |

## 前提条件

- Node.js 20+
- Docker / Docker Compose
- GitHub OAuth App (Client ID / Secret)
- OpenAI API キー

## クイックスタート

```bash
# 1. リポジトリをクローン
git clone https://github.com/your-org/gitpath.git
cd gitpath

# 2. 環境変数を設定
cp .env.example backend/.env
# backend/.env を編集して各キーを設定

# 3. Docker で PostgreSQL / Redis を起動
npm run docker:up

# 4. 依存パッケージをインストール
npm run install:all

# 5. 共有パッケージをビルド
npm run build:shared

# 6. データベースマイグレーション & シード
cd backend
npx prisma migrate dev
npx prisma db seed
cd ..

# 7. 開発サーバーを起動
npm run dev:backend   # http://localhost:3001
npm run dev:frontend  # http://localhost:3000
```

## プロジェクト構成

```
gitpath/
├── backend/                  # Express API サーバー
│   ├── prisma/
│   │   ├── schema.prisma     # DB スキーマ定義
│   │   └── seed.ts           # マスターデータ投入
│   └── src/
│       ├── index.ts          # エントリーポイント
│       ├── routes/           # API ルート定義
│       ├── middleware/       # JWT 認証ミドルウェア
│       └── lib/              # ユーティリティ (Prisma, Redis, OpenAI, JWT, 暗号化)
├── frontend/                 # Next.js フロントエンド
│   └── src/
│       ├── app/              # App Router ページ
│       ├── components/       # UI コンポーネント
│       ├── stores/           # Zustand 状態管理
│       └── lib/              # API クライアント, ユーティリティ
├── shared/                   # 共有型定義・ユーティリティ
├── docker-compose.yml        # PostgreSQL + Redis
├── .env.example              # 環境変数テンプレート
├── Plan.md                   # 実装計画
└── PRD.md                    # 製品要件定義書
```

## 利用可能なスクリプト

| コマンド | 説明 |
|---------|------|
| `npm run dev:frontend` | フロントエンド開発サーバー起動 |
| `npm run dev:backend` | バックエンド開発サーバー起動 |
| `npm run install:all` | 全パッケージの依存関係をインストール |
| `npm run build:shared` | 共有パッケージをビルド |
| `npm run build:frontend` | フロントエンドをビルド |
| `npm run build:backend` | バックエンドをビルド |
| `npm run docker:up` | Docker コンテナ起動 (PostgreSQL + Redis) |
| `npm run docker:down` | Docker コンテナ停止 |

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                      ブラウザ                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Next.js UI  │  │  xterm.js    │  │  Zustand      │  │
│  │  (App Router)│  │  (ターミナル) │  │  (状態管理)   │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
└─────────┼─────────────────┼─────────────────────────────┘
          │ HTTP/REST        │ WebSocket
          ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                   Express サーバー                        │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  REST API  │  │  WebSocket   │  │  JWT 認証       │  │
│  │  Routes    │  │  (node-pty)  │  │  Middleware     │  │
│  └──────┬─────┘  └──────────────┘  └─────────────────┘  │
│         │                                                │
│  ┌──────┴──────────────────────────────────────────────┐ │
│  │                外部 API 連携                         │ │
│  │  ┌──────────────┐        ┌───────────────────────┐  │ │
│  │  │  OpenAI API  │        │  GitHub REST/GraphQL  │  │ │
│  │  │  (GPT-4o)    │        │  API + OAuth          │  │ │
│  │  └──────────────┘        └───────────────────────┘  │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────┬───────────────────────────┬───────────────────┘
          │                           │
          ▼                           ▼
   ┌──────────────┐           ┌──────────────┐
   │ PostgreSQL 15│           │   Redis 7    │
   │ (メインDB)   │           │ (セッション  │
   │              │           │  キャッシュ)  │
   └──────────────┘           └──────────────┘
```

## ライセンス

MIT License - 詳細は [LICENSE](./LICENSE) を参照。
