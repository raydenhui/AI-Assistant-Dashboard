# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Prisma 5.x requires OpenSSL 1.1 on alpine
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY prisma ./prisma

# Generate Prisma client before compiling TypeScript
RUN npx prisma generate

COPY src ./src
RUN npm run build

# ── Production stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Prisma 5.x requires OpenSSL at runtime; curl is needed for healthcheck
RUN apk add --no-cache openssl curl

WORKDIR /app

ENV NODE_ENV=production

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output and Prisma artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

CMD ["node", "dist/app.js"]
