# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
# Copy source excluding node_modules (which may come from Windows host without exec bits)
COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.tsbuildinfo* ./
COPY frontend/src ./src
COPY frontend/public* ./public/
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-build
WORKDIR /build
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend/src ./src
COPY backend/prisma ./prisma
COPY backend/tsconfig.json backend/nest-cli.json ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini

COPY --from=backend-build /build/dist ./dist
COPY --from=backend-build /build/node_modules ./node_modules
COPY --from=backend-build /build/prisma ./prisma
COPY --from=backend-build /build/package.json ./
COPY --from=frontend-build /build/dist ./public

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && mkdir -p /app/data /app/backup

ENV NODE_ENV=production
EXPOSE 6000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/docker-entrypoint.sh"]
