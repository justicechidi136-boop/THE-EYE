FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json ./
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install --include=dev

FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "--workspace", "apps/admin-web", "run", "dev"]

FROM deps AS builder
ARG NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_API_BASE_URL
ENV NODE_ENV=production
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY . .
RUN node apps/admin-web/scripts/validate-docker-build-env.mjs
RUN npm --workspace packages/shared run build
RUN npm --workspace apps/admin-web run build

FROM base AS production
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/admin-web/package.json ./apps/admin-web/package.json
COPY --from=builder /app/apps/admin-web/.next ./apps/admin-web/.next
COPY --from=builder /app/apps/admin-web/public ./apps/admin-web/public
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/node_modules ./node_modules
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 CMD node -e "require('http').get('http://127.0.0.1:3000',(r)=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["npm", "--workspace", "apps/admin-web", "run", "start"]
