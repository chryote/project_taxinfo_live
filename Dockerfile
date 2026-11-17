# Stage 1: Build Vue.js 3 Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/tsconfig*.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/src/ ./src/
RUN npm run build

# Stage 2: Build Fastify TypeScript Backend
FROM node:22-alpine AS backend-builder
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/tsconfig.json ./
COPY backend/src/ ./src/
RUN npm run build

# Stage 3: Unified Production Runtime (Google Cloud Run / Standalone Docker Ready)
FROM node:22-alpine AS runner
WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=8080
ENV ENABLE_ECO_MODE=true

COPY backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=backend-builder /build/backend/dist ./dist
COPY --from=frontend-builder /build/frontend/dist ../frontend/dist

USER node
EXPOSE 8080

CMD ["node", "dist/index.js"]
