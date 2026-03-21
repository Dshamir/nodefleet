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

COPY package.json package-lock.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/index.js"]
