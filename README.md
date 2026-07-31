# 私の競泳物語

日々の練習日誌と、自分自身の競泳物語を記録する会員制 Web アプリです。

## 主な機能

- 利用者自身によるアカウント作成とログイン
- 1日1件の練習日誌（自己評価、振り返り、次回の意識）
- 15の問いから作る競泳物語とバージョン履歴
- 日誌と物語更新をまとめた振り返り
- 管理者によるユーザー作成、有効化・無効化、記録の閲覧

## 技術スタック

- Next.js 16 / React 19 / TypeScript
- PostgreSQL / Prisma
- カスタムセッション認証（HttpOnly Cookie、DBにはトークンのハッシュのみ保存）
- CSSによるレスポンシブ・ダークモード対応

## ローカルセットアップ

必要な環境は Node.js 22.13 以上の 22.x LTS、または Node.js 24 以上と PostgreSQL です。

```bash
npm ci
cp .env.example .env
npm run db:init
```

`.env` の `DATABASE_URL` は利用する PostgreSQL に合わせて変更してください。

管理者アカウントを作成します。

```bash
ADMIN_LOGIN_ID=admin \
ADMIN_PASSWORD='10文字以上の安全なパスワード' \
ADMIN_DISPLAY_NAME='管理者' \
npm run admin:create
```

開発サーバーを起動します。

```bash
npm run dev
```

## 品質チェック

```bash
npm run check
ALLOW_INTEGRATION_DB_TESTS=1 DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/swim_story_test" npm run test:db
ALLOW_INTEGRATION_DB_TESTS=1 DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/swim_story_test" npm run test:migrations
DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/swim_story" npm run build
npm run audit:prod
```

`npm run check` は ESLint、Prisma Client 生成を含む型検査、ユニットテストを順に実行します。`npm run test:db` は専用のテストDBで実行し、並列レート制限、セッション上限、日誌の競合更新、物語の同時作成を検証します。`npm run test:migrations` は一時DBを作成し、旧データを投入してから全マイグレーションを実行し、アーカイブ値の保持と連鎖削除防止を確認後に一時DBを削除します。

## データベース運用

- 開発時のマイグレーション作成: `npm run db:migrate -- --name <name>`
- 本番への既存マイグレーション適用: `npm run db:init`
- `prisma/migrations` は必ず Git で管理します
- `db:push` は試作用であり、本番デプロイには使用しません

2026年8月のマイグレーションでは、廃止した旧計測機能のテーブルをアプリから切り離し、`archived_growth_profiles` と `archived_growth_measurements` に改名して保存します。データは自動削除せず、利用者の削除に連動しないよう外部キーも `RESTRICT` に変更します。保持期間を決めたうえで削除または匿名化する場合は、暗号化バックアップと復元テストを済ませ、別の明示的な作業として実施してください。

同時にセッショントークンをハッシュ保存へ移行するため、適用時に既存セッションは一度無効になり、利用者は再ログインが必要です。旧バージョンとはDB互換性がないため、本番では書き込みを止めたメンテナンス時間内に `npm run db:init` と新バージョンの切り替えを連続して行い、旧バージョンへ戻さないでください。

## セキュリティ上の仕様

- 新規アカウントのパスワードは10文字以上、bcryptの上限であるUTF-8 72バイト以内
- 旧仕様の長いID・72バイト超パスワードはログイン互換を維持し、旧bcrypt cost 10ハッシュは成功時にcost 12へ更新
- ログインと自己登録はDB共有型の試行回数制限を適用
- 日誌・物語の保存にも利用者単位（物語は全体上限も含む）のDB共有型レート制限を適用
- 試行回数制限はDBロックで原子的に消費し、期限切れイベントを自動削除
- Cookieは本番で `Secure` / `HttpOnly` / `SameSite=Lax`（外部リンクのGETは維持し、クロスサイトPOSTには送信しない）
- 更新APIは同一オリジンと `application/json` を検証
- リクエスト本文はストリーム読み込み中にサイズ上限を適用
- 日誌・物語はサーバー側で型、日付、文字数、同時更新を検証
- 管理者のユーザー作成・状態変更は監査イベントとして保存

`TRUSTED_PROXY_IP_HEADER` には、インターネットから直接届く値ではなく、デプロイ先のリバースプロキシまたはCDNが上書き・追記するヘッダーを指定してください。`x-forwarded-for` の場合は右端の値を利用します。未設定時は安全側に倒して全リクエストを同じ送信元として制限します。

## デプロイ

1. `DATABASE_URL` と `TRUSTED_PROXY_IP_HEADER` をデプロイ環境の Secret に登録
2. 別環境で `npm ci && npm run check && npm run build` を完了
3. 暗号化バックアップを取得し、別DBへの復元テストを完了
4. メンテナンス表示に切り替え、アプリからのDB書き込みを停止
5. `npm run db:init && npm run db:verify` を実行
6. 新バージョンを起動し、管理者ログイン・利用者ログイン・日誌保存・物語保存をスモークテスト
7. 問題がなければメンテナンス表示を解除

マイグレーション後に失敗した場合は旧アプリだけを再起動せず、書き込み停止を維持してください。原因を修正して新バージョンを再デプロイするか、バックアップを別DBへ復元して接続先を切り替えます。

Replit では Workspace Secrets と Deployment Secrets の両方に `DATABASE_URL` と `TRUSTED_PROXY_IP_HEADER` を登録してください。
