FROM node:22-slim

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node index.mjs ./index.mjs
COPY --chown=node:node src ./src
COPY --chown=node:node sql ./sql
COPY --chown=node:node assets ./assets
COPY --chown=node:node config ./config

USER node

EXPOSE 8080

CMD ["npm", "start"]
