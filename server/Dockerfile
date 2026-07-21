# ─── Build stage: install runtime deps ──────────────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Install production deps + tsx (used to run TS directly at runtime).
RUN npm install --omit=dev && npm install tsx@^4.19.1

# ─── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

# State lives in PostgreSQL (see docker-compose.yml); no local volume needed.
EXPOSE 4000
CMD ["node_modules/.bin/tsx", "src/index.ts"]
