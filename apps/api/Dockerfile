FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat && \
    corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
COPY apps/api/prisma/migrations apps/api/prisma/migrations
RUN pnpm --filter @the-eye/api run prisma:generate
COPY . .
RUN pnpm --filter @the-eye/shared run build
RUN pnpm --filter @the-eye/api run prisma:generate
RUN pnpm --filter @the-eye/api exec nest build

# pnpm deploy materializes prod deps (no workspace symlinks) for a portable runtime tree.
FROM builder AS deploy-prod
RUN pnpm --filter @the-eye/api deploy --prod /app/deploy
RUN find /app/deploy/node_modules -type d -name '.prisma' -print0 | xargs -0 rm -rf 2>/dev/null || true
RUN pnpm --filter @the-eye/api exec prisma generate --schema=/app/deploy/prisma/schema.prisma
WORKDIR /app/deploy
RUN node ./scripts/diagnose-prisma-location-model.cjs

# Full deploy retains prisma/tsx for compose tools profile (migrate, seed, admin bootstrap).
FROM builder AS deploy-tools
RUN pnpm --filter @the-eye/api deploy /app/deploy
RUN find /app/deploy/node_modules -type d -name '.prisma' -print0 | xargs -0 rm -rf 2>/dev/null || true
RUN pnpm --filter @the-eye/api exec prisma generate --schema=/app/deploy/prisma/schema.prisma
WORKDIR /app/deploy
RUN node ./scripts/diagnose-prisma-location-model.cjs

FROM base AS production
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
COPY --from=deploy-prod --chown=nestjs:nodejs /app/deploy /app
WORKDIR /app
USER nestjs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 CMD node -e "require('http').get('http://127.0.0.1:4000/v1/health/ready',(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>process.exit(r.statusCode===200?0:1));}).on('error',()=>process.exit(1))"
CMD ["node", "--require", "./src/preload-env.cjs", "dist/main.js"]

FROM base AS tools
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
COPY --from=deploy-tools --chown=nestjs:nodejs /app/deploy /app
WORKDIR /app
USER nestjs
CMD ["node", "--require", "./src/preload-env.cjs", "dist/main.js"]
