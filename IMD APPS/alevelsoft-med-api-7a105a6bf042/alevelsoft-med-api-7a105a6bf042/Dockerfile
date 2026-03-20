FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache git
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3002
CMD ["node", "dist/src/main"]
