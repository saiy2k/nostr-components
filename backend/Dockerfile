FROM node:22-slim

WORKDIR /app

COPY package.json ./
# --legacy-peer-deps avoids an npm arborist crash (edgesOut) with these deps.
RUN npm install --omit=dev --legacy-peer-deps

COPY --chown=node:node relays.json ./relays.json
COPY --chown=node:node relay-directory ./relay-directory

ENV NODE_ENV=production

USER node
ENTRYPOINT ["node"]
CMD ["relay-directory/backfill.js"]
