# GitPath Frontend

Next.js 14 (App Router) + TypeScript で構築された GitPath の Web フロントエンド。

## ページ一覧

| パス | ページ名 | 説明 |
|------|---------|------|
| `/` | トップページ | ランディングページ。サインアップ/ログイン導線、達成者数表示 |
| `/onboarding/hearing` | ヒアリング | チャット形式で最大 5 問のヒアリング。AI が質問を動的生成 |
| `/onboarding/curriculum` | カリキュラム提示 | AI が生成した個別カリキュラム概要を表示 |
| `/learn/sandbox` | 概念体感サンドボックス | ブラウザ内でファイル編集・バージョン喪失体験 |
| `/learn/terminal` | 仮想ターミナル | xterm.js + WebSocket で実際の Git コマンドを実行 |
| `/certificate/[id]` | 達成証明カード | 共有可能な達成証明の公開ページ (認証不要) |

## コンポーネント構成

```
src/components/
├── auth/           # 認証関連 (サインアップ/ログインフォーム、OAuth ボタン)
├── chat/           # チャットインターフェース (ヒアリング画面用)
├── common/         # 共通コンポーネント (タイマー、プログレスバー等)
├── layout/         # レイアウト (ヘッダー、フッター)
├── learning/       # 学習関連 (マイルストーン表示、カリキュラム等)
├── sandbox/        # サンドボックス (ファイルエディタ、Git デモ)
├── terminal/       # ターミナル (xterm.js ラッパー、AI ガイドパネル)
└── ui/             # shadcn/ui ベースコンポーネント
```

## 状態管理 (Zustand)

| ストア | ファイル | 説明 |
|--------|---------|------|
| Auth Store | `stores/authStore.ts` | ユーザー認証状態、トークン管理 |
| Session Store | `stores/sessionStore.ts` | 学習セッション、マイルストーン進捗 |
| Timer Store | `stores/timerStore.ts` | 30 分タイマー、経過時間追跡 |
| Hearing Store | `stores/hearingStore.ts` | ヒアリング回答、質問状態 |

## E2E テスト

テストフレームワーク: [Playwright](https://playwright.dev/)

```bash
# E2E テスト実行
npm run test:e2e

# Playwright UI モードで実行
npm run test:e2e:ui
```

## 開発

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Lint
npm run lint
```
