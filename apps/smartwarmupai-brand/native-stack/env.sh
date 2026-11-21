# Development-only settings for a Docker-less local stack (the keys below are upstream's published dev defaults, never use them in production).
# Usage: source this file, then run the binaries built by `npm run server:build`. See apps/warmbly-server/UPSTREAM.md.
export APP_ENV=dev AWS_CONFIG_ENABLED=false EVENTBUS_PROVIDER=nats NATS_URL=nats://localhost:4222 CODEC_PROVIDER=json KMS_PROVIDER=local
export KMS_LOCAL_MASTER_KEY=Xr0JA7gqF2POy29a7MRByyqddivTNt8WOyKsOXklazk= CREDENTIALS_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
export BLOB_PROVIDER=filesystem BLOB_FS_ROOT=/tmp/warmbly-blobs BLOB_PUBLIC_BASE_URL=http://localhost:8080/public TASKS_PROVIDER=local BILLING_PROVIDER=none CAPTCHA_PROVIDER=none PUBSUB_ENABLED=false ENCRYPTED_KEYS_PROVIDER=postgres
export PRIMARY_DB='postgres://warmbly:warmbly@localhost:15432/warmbly_dev?sslmode=disable' REDIS=redis://localhost:16379
export MAIL_TRANSPORT=smtp EMAIL_NAME='Warmbly Dev' EMAIL_ADDRESS=dev@warmbly.local SMTP_HOST=localhost SMTP_PORT=11025 SMTP_SECURITY=none
export API_HOST=0.0.0.0:8080 FORMS_DOMAIN=localhost:8090 PORTAL_DOMAIN=localhost:8095 PORTAL_EDGE_TOKEN=local-dev-portal-edge-token-0123456789abcdef GIN_MODE=release
export APP_URL=http://localhost:5173 CORS_ALLOW_ORIGINS=http://localhost:5173 WEBSOCKET_URL=ws://localhost:4000/socket/websocket AUTH_SECRET=local-dev-auth-secret-minimum-32-characters-long
export EMAIL_BRAND_NAME=SmartWarmupAI
export TRACKING_DOMAIN=localhost:3000 AUTH_LOGIN_CODE=off INTERNAL_API_TOKEN=local-dev-internal-token MAILVENDOR_SANDBOX_URL=
mkdir -p /tmp/warmbly-blobs
export GEODB_PATH=data/GeoLite2-City.mmdb
