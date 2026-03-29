FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Build stage
FROM dependencies AS builder
COPY . .
RUN npm run build

# Production stage
FROM base AS runner

ENV NODE_ENV production
ENV PORT 8080

RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodeuser && \
    adduser -S wsserver -u 1001 -G nodeuser

COPY package.json package-lock.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R wsserver:nodeuser /app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

USER wsserver

CMD ["node", "dist/index.js"]
