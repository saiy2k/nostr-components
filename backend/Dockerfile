FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node relays.json ./relays.json
COPY --chown=node:node nostr-atlas ./nostr-atlas

ENV NODE_ENV=production

USER node
ENTRYPOINT ["node"]
CMD ["nostr-atlas/backfill.js"]
