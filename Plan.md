# GitPath - Implementation Plan

## Project Overview
非エンジニア向けGit/CI/CD習得プラットフォーム。AIによる個別最適化で、GitHubアカウント作成からCI/CD構築まで30分で完走させる。

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + xterm.js + Zustand
- **Backend**: Node.js + Express + TypeScript + WebSocket (ws) + node-pty + OpenAI API + GitHub API
- **Database**: PostgreSQL 15 + Redis 7

## Team Roles
| Role | Responsibility |
|------|---------------|
| PO | PRD準拠の検証、タスク優先度管理、受け入れ基準の判定 |
| Tech Lead | アーキテクチャ設計、プロジェクト基盤構築、コードレビュー |
| Backend Engineer | API実装、DB接続、WebSocket、外部API統合 |
| Frontend Engineer | UI実装、xterm.js統合、Zustand状態管理 |
| Designer | shadcn/ui + Tailwind CSSでUIコンポーネント設計 |
| QA | テスト戦略、E2Eテスト、エッジケース検証 |

## Phase 1: Foundation (基盤構築)
### 1.1 Project Scaffolding
- [ ] Next.js 14 App Router プロジェクト初期化
- [ ] Express + TypeScript バックエンドセットアップ
- [ ] Monorepo構成 (packages: frontend, backend, shared)
- [ ] ESLint + Prettier 設定
- [ ] Docker Compose (PostgreSQL + Redis)

### 1.2 Database Setup
- [ ] PostgreSQL スキーマ作成 (spec.jsonのdbSchema)
- [ ] Prisma ORM セットアップ
- [ ] マイルストーン定義マスターデータ投入
- [ ] Redis接続設定

### 1.3 Authentication
- [ ] POST /api/auth/signup (email + Google)
- [ ] POST /api/auth/login
- [ ] POST /api/auth/refresh
- [ ] JWT middleware
- [ ] Google OAuth integration

## Phase 2: Core Backend APIs
### 2.1 Session Management
- [ ] POST /api/sessions (新規セッション作成)
- [ ] GET /api/sessions/:sessionId
- [ ] PATCH /api/sessions/:sessionId/step

### 2.2 Hearing System
- [ ] POST /api/hearing/start
- [ ] POST /api/hearing/:hearingSessionId/answer
- [ ] GET /api/hearing/:hearingSessionId/previous

### 2.3 AI Integration
- [ ] POST /api/ai/explain (OpenAI API統合)
- [ ] POST /api/ai/generate-yaml
- [ ] AI応答フィルタリング
- [ ] タイムアウト・エラーハンドリング

### 2.4 GitHub OAuth & Verification
- [ ] POST /api/github/oauth/start
- [ ] POST /api/github/oauth/callback
- [ ] POST /api/milestones/:milestoneId/verify
- [ ] GET /api/milestones/session/:sessionId

### 2.5 Terminal & Sandbox
- [ ] POST /api/terminal/sessions (node-pty)
- [ ] DELETE /api/terminal/sessions/:terminalSessionId
- [ ] WebSocket ターミナルセッション
- [ ] POST /api/sandbox/reset
- [ ] POST /api/sandbox/events
- [ ] POST /api/command/validate (危険コマンドブロック)
- [ ] POST /api/command/errors

### 2.6 Certificate
- [ ] POST /api/certificates
- [ ] GET /api/certificates/:certificateId (公開・認証不要)

## Phase 3: Frontend Implementation
### 3.1 Shared Components & Layout
- [ ] 共通レイアウト (Header, Footer, Navigation)
- [ ] AuthModal (SignUp/Login)
- [ ] ChatInterface component
- [ ] Timer component
- [ ] MilestoneProgressBar

### 3.2 Pages
- [ ] トップページ (/)
- [ ] 認証ページ (/auth)
- [ ] ヒアリングページ (/onboarding/hearing)
- [ ] カリキュラム提示ページ (/onboarding/curriculum)
- [ ] サンドボックスページ (/learn/sandbox)
- [ ] ターミナルページ (/learn/terminal)
- [ ] 達成証明ページ (/certificate/:id)

### 3.3 Terminal Integration
- [ ] xterm.js + WebSocket接続
- [ ] AIガイド表示パネル
- [ ] コマンドサジェスト機能
- [ ] エラー検出・AI説明表示

### 3.4 Sandbox
- [ ] ブラウザ内ファイルエディタ
- [ ] バージョン喪失体験フロー
- [ ] Git復元デモ

## Phase 4: Integration & Polish
- [ ] E2E学習フロー結合テスト
- [ ] エッジケース対応
- [ ] WCAG 2.1 AA準拠確認
- [ ] パフォーマンス最適化

## Implementation Rules (PRDより)
- モックデータ・ハードコード配列・スタブAPI での実装は完了とみなさない
- すべてのデータは実際のDB/APIから取得・保存
- バックエンドAPI未実装の場合、UIより先にバックエンドの最小実装を作る
- 未実装機能はUI上で明示的に「未実装」と表示

## Progress Tracking
- Phase 1: [x] Complete (基盤 + DB/Prisma + 認証)
- Phase 2: [x] Complete (全バックエンドAPI実装完了)
- Phase 3: [x] Complete (全UIページ + コンポーネント実装完了)
- Phase 4: [~] In Progress (API統合 + E2Eテスト)

## Additional Tasks
- [~] #15: Frontend-Backend API統合 (tech-lead)
- [~] #16: E2E テストセットアップ (designer)
- [~] #11: バックエンド統合テスト + TS修正 (backend-engineer)
