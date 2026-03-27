FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies stage
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Build stage
FROM dependencies AS builder
COPY . .
# Provide dummy env vars needed at build time (actual values come from .env at runtime)
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV NEXTAUTH_SECRET=build-time-placeholder
ENV NEXTAUTH_URL=
ENV AUTH_URL=
RUN npm run build

# Production stage
FROM base AS runner

ENV NODE_ENV production

RUN apk add --no-cache curl
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
