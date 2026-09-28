FROM node:22-slim

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node backend/relays.json ./relays.json
COPY --chown=node:node backend/nostr-atlas ./nostr-atlas
COPY --chown=node:node functions/featured-handles.js /functions/featured-handles.js

ENV NODE_ENV=production

USER node
ENTRYPOINT ["node"]
CMD ["nostr-atlas/backfill.js"]
