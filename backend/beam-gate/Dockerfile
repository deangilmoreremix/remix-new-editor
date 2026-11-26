# SmartVidDownloader gate for Beam. Build context: the repository root (app.py passes it).
FROM node:22-slim
WORKDIR /app
RUN echo '{"name":"vidbee-gate","private":true,"type":"module"}' > package.json \
 && npm install --omit=dev --no-audit --no-fund express@^4.18.2 cors@^2.8.5
COPY backend/services/vidbeeProxy.js ./services/vidbeeProxy.js
COPY backend/middleware/auth.js ./middleware/auth.js
COPY backend/beam-gate/gate-server.mjs ./gate-server.mjs
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "gate-server.mjs"]
