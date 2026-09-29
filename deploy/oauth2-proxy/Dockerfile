# 検証環境の入口。Google でログインした、許可したメールアドレスの人だけをアプリへ通す
# 設定は Railway のサービス変数（OAUTH2_PROXY_*）で渡す。docs/deploy.md を参照
#
# 許可するメールアドレスは公開リポジトリに書かず、Railway の変数 ALLOWED_EMAILS（カンマ区切り）から
# ビルド時にファイルへ書き出す。変数を変えると Railway が作り直すので、そのたびに反映される
FROM busybox:1.37 AS emails
ARG ALLOWED_EMAILS
RUN test -n "$ALLOWED_EMAILS" && echo "$ALLOWED_EMAILS" | tr ',' '\n' | sed 's/^ *//;s/ *$//' > /emails.txt

FROM quay.io/oauth2-proxy/oauth2-proxy:v7.15.4
COPY --from=emails /emails.txt /etc/oauth2-proxy/emails.txt
ENV OAUTH2_PROXY_AUTHENTICATED_EMAILS_FILE=/etc/oauth2-proxy/emails.txt
