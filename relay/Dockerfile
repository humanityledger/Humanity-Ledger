# Ledger Relay: one small image, no build step, runs as an unprivileged user.
#   docker build -t ledger-relay relay/
#   docker run -p 8080:8080 -e RELAY_TURN_SECRET=... -e RELAY_TURN_URLS=turn:turn.example.org:3478 ledger-relay
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src
RUN mkdir -p /data/blobs && chown -R node:node /data
USER node
ENV PORT=8080 RELAY_BLOB_DIR=/data/blobs RELAY_PUSH_FILE=/data/push.json
# No volume declared here: some hosts (Railway) refuse that instruction. Mount /data yourself to keep blobs and
# push subscriptions across restarts (docker compose and the Helm chart already do).
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "src/server.mjs"]
