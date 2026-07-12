FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install --include=dev

FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 4000
CMD ["npm", "--workspace", "apps/api", "run", "start:dev"]

FROM deps AS builder
COPY . .
RUN npm --workspace packages/shared run build
RUN npm --workspace apps/api run prisma:generate
RUN npm --workspace apps/api run build

FROM base AS production
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules ./node_modules
WORKDIR /app
USER nestjs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 CMD node -e "require('http').get('http://127.0.0.1:4000/v1/health/ready',(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>process.exit(r.statusCode===200?0:1));}).on('error',()=>process.exit(1))"
CMD ["node", "--require", "apps/api/src/preload-env.cjs", "apps/api/dist/main.js"]
