# 検証環境（Railway）

画面を人に見せるための検証環境。Railway の1つのプロジェクトに、2つのサービスを置く。

```
ブラウザ → oauth2-proxy（公開 URL。Google でログインし、許可したメールアドレスだけ通す）
             → app（非公開。Railway の内部ネットワークからだけ届く）
                 └ ボリューム /app/data に SQLite
```

- データは SQLite のファイルなので、Vercel のようにファイルが残らない所には置けない。ボリュームを付けた Railway に置く
- app には公開ドメインを付けない。oauth2-proxy を飛ばして直接は開けない
- Google を通ったあとで、アプリ自身のログインもある（2回ログインする）
- メールは送らない。アカウントは管理者が「アカウント管理」から直接作り、初期パスワードを本人に伝える

## app サービス

GitHub の main から自動でデプロイする。ルートの `Dockerfile` を使う。

| 変数 | 値 |
|---|---|
| `PORT` | `3000` |
| `DATABASE_URL` | `file:/app/data/dev.db` |
| `BETTER_AUTH_SECRET` | 長いランダムな文字列 |
| `BETTER_AUTH_URL` | oauth2-proxy の公開 URL（`https://….up.railway.app`） |
| `GITHUB_TOKEN` など | 任意。画面右下の「要望を送る」を使うときだけ。`.env.example` を参照 |

ボリュームは `/app/data` に付ける。

## oauth2-proxy サービス

同じリポジトリから、`deploy/oauth2-proxy/Dockerfile` を使ってデプロイする。

| 変数 | 値 |
|---|---|
| `RAILWAY_DOCKERFILE_PATH` | `deploy/oauth2-proxy/Dockerfile` |
| `ALLOWED_EMAILS` | 通す Google アカウントのメールアドレス（カンマ区切り）。変えると作り直されて反映される |
| `OAUTH2_PROXY_PROVIDER` | `google` |
| `OAUTH2_PROXY_CLIENT_ID` / `OAUTH2_PROXY_CLIENT_SECRET` | Google Cloud で作った OAuth クライアント |
| `OAUTH2_PROXY_COOKIE_SECRET` | 32バイトの乱数を URL-safe base64 にしたもの |
| `OAUTH2_PROXY_UPSTREAMS` | `http://app.railway.internal:3000` |
| `OAUTH2_PROXY_HTTP_ADDRESS` | `0.0.0.0:4180` |
| `OAUTH2_PROXY_REDIRECT_URL` | `https://<公開 URL>/oauth2/callback` |
| `OAUTH2_PROXY_REVERSE_PROXY` | `true` |
| `OAUTH2_PROXY_SKIP_PROVIDER_BUTTON` | `true` |

公開ドメインは oauth2-proxy にだけ付け、ポートは 4180 にする。

## Google の OAuth クライアント

Google Cloud コンソールの「API とサービス」→「認証情報」で、種類を「ウェブ アプリケーション」にして作る。

- 承認済みの JavaScript 生成元: `https://<公開 URL>`
- 承認済みのリダイレクト URI: `https://<公開 URL>/oauth2/callback`
- OAuth 同意画面が「テスト」のままなら、テストユーザーに通す人のアドレスも足す

## 最初の管理者

初回デプロイのあと公開 URL を開くと、ユーザーがまだいないので初回セットアップ画面が出る。そこで管理者を作る。
