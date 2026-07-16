FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat && \
    corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 4000
CMD ["pnpm", "--filter", "@the-eye/api", "run", "start:dev"]

FROM deps AS builder
COPY . .
RUN pnpm --filter @the-eye/shared run build
RUN pnpm --filter @the-eye/api run prisma:generate
RUN pnpm --filter @the-eye/api exec nest build

FROM base AS production
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/src/preload-env.cjs ./apps/api/src/preload-env.cjs
COPY --from=builder /app/node_modules ./node_modules
WORKDIR /app
USER nestjs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 CMD node -e "require('http').get('http://127.0.0.1:4000/v1/health/ready',(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>process.exit(r.statusCode===200?0:1));}).on('error',()=>process.exit(1))"
CMD ["node", "--require", "apps/api/src/preload-env.cjs", "apps/api/dist/main.js"]
