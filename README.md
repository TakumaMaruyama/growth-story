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
- Replit の Secrets で `DATABASE_URL` を設定
- Replit の PostgreSQL アドオンを使用推奨

### 3. データベースの初期化

```bash
# マイグレーションファイルを作成（開発時）
npm run db:migrate

# または既存のマイグレーションを適用（本番）
npm run db:init

# Prisma Clientを生成
npm run db:generate
```

**Replitでの推奨手順**:
```bash
npm run db:push  # スキーマを直接プッシュ
npm run db:generate
```

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

1. Secrets に `DATABASE_URL` を設定
2. `npm run db:push && npm run db:generate` を実行
3. 管理者を作成: `ADMIN_LOGIN_ID=admin ADMIN_PASSWORD=xxx npm run admin:create`
4. `npm run build && npm run start` でアプリ起動
