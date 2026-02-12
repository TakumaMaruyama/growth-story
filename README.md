# 身長予測 & 私の競泳物語

会員制の成長記録と競泳日誌管理アプリケーション（MVP版）

## 技術スタック

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma
- **Styling**: Tailwind CSS
- **Authentication**: カスタムセッション（DB管理、httpOnly Cookie）

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env` ファイルを作成し、PostgreSQLの接続URLを設定:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/growth_story_db"
```

**Replitでデプロイする場合**:
- Replit の Workspace Secrets と Deployments Secrets の両方で `DATABASE_URL` を設定
- Replit の PostgreSQL アドオンを使用推奨

### 3. データベース初期化とマイグレーション

```bash
# Prisma Clientを生成
npm run db:generate

# 開発時: マイグレーションを作成して適用
npm run db:migrate -- --name <migration_name>

# 本番/デプロイ時: 既存マイグレーションを適用
npm run db:init
```

補足:
- `npm run db:push` は開発用の試行コマンドとしては利用可能ですが、デプロイ手順には含めません
- `prisma/migrations` 配下のファイルは必ずGitで管理します

### 4. 管理者ユーザーの作成

```bash
ADMIN_LOGIN_ID=admin ADMIN_PASSWORD=your_secure_password npm run admin:create
```

オプション: `ADMIN_DISPLAY_NAME=管理者` で表示名も設定可能

### 5. アプリケーションの起動

```bash
# 開発モード
npm run dev

# 本番モード
npm run build
npm run start
```

## 主要な機能

### ユーザー機能
- **日誌** (`/daily`): 毎日の練習記録、点数、振り返り
- **物語** (`/story`): Q1〜Q15の競泳ストーリー（バージョン管理）
- **成長** (`/growth`): 身長・体重測定、KR法による最終身長予測
- **タイムライン** (`/timeline`): 物語と測定の時系列表示

### 管理者機能
- **ユーザー管理** (`/admin/users`): ユーザー作成、有効/無効化
- **ユーザー詳細閲覧**: 日誌、物語、成長記録の閲覧（読み取り専用）

## KR法係数ファイル

`src/data/kr_coeff.json` にサンプル係数を配置しています。
本番環境では実際のKhamis-Roche係数に差し替えてください。

## 動作確認チェックリスト

- [ ] ログイン・ログアウトが正常に動作する
- [ ] ユーザーダッシュボードが表示される
- [ ] 日誌の入力・保存ができる
- [ ] 物語の作成・バージョン管理ができる
- [ ] 成長プロフィールの設定ができる
- [ ] 測定の追加ができる
- [ ] KR法による予測が表示される（プロフィール・測定・親の身長設定後）
- [ ] タイムラインに物語と測定が表示される
- [ ] 管理者がユーザーを作成できる
- [ ] 管理者がユーザーの各データを閲覧できる
- [ ] 無効化されたユーザーはログインできない

## Replitデプロイメモ

### 初回デプロイ

1. ReplitでPostgreSQLを作成
2. Deployments Secrets に `DATABASE_URL` を設定（Workspace Secretsとは別）
3. 依存をインストール: `npm ci`
4. Prisma Clientを生成: `npm run db:generate`
5. 初回マイグレーション作成・適用: `npm run db:migrate -- --name init`
6. 初回管理者を作成: `ADMIN_LOGIN_ID=admin ADMIN_PASSWORD=xxx npm run admin:create`
7. 生成された `prisma/migrations/...` と `prisma/migrations/migration_lock.toml` をコミットして push
8. ビルド/起動: `npm run build && npm run start`

### 2回目以降のデプロイ

1. 最新コードをpull
2. 依存をインストール: `npm ci`
3. ビルド: `npm run build`
4. 起動前にマイグレーション適用: `npm run db:init`
5. 起動: `npm run start`

### migrate dev がReplit上で失敗する場合

- ローカルのPostgreSQL環境で `npm run db:migrate -- --name init` を実行して migration ファイルを生成
- 生成物をGitにコミットしてReplitに反映
- Replit側では `npm run db:init` のみ実行して適用
