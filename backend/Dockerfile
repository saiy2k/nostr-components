FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node relays.json ./relays.json
COPY --chown=node:node relay-directory ./relay-directory

ENV NODE_ENV=production

USER node
ENTRYPOINT ["node"]
CMD ["relay-directory/backfill.js"]
