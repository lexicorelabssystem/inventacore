FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npx prisma generate

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache tini

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src ./src

USER node
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
