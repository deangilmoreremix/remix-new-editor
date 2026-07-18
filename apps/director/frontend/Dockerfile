FROM node:22.8.0-alpine

WORKDIR /app

# The frontend depends on local workspace packages via `file:` references
# (packages/layout -> packages/tokens, packages/navigation). The build context
# is the repo root, so copy the frontend manifest plus those shared packages
# (with their manifests) before installing, otherwise npm cannot resolve the
# file: links and the production build fails.
COPY apps/director/frontend/package*.json ./
COPY packages/tokens ./packages/tokens
COPY packages/navigation ./packages/navigation
COPY packages/layout ./packages/layout

RUN npm install

COPY apps/director/frontend/. .

RUN npm run build

EXPOSE 10000

# Vite preview serves the production build. Render assigns a dynamic port via
# the PORT env var; pass it through so the server binds to the expected port.
CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT:-10000}"]
