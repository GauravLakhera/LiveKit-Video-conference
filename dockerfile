# Build stage
FROM node:22.19-alpine AS build
WORKDIR /app

# copy lockfile first for caching
COPY package*.json ./

# reproducible install for build
RUN npm ci

# copy source & build
COPY . .
RUN npm run build

# Production stage
FROM node:22.19-alpine AS production
WORKDIR /app

# copy package manifests and install only prod deps
COPY package*.json ./
RUN npm ci --omit=dev

# copy compiled output
COPY --from=build /app/dist ./dist

# copy any runtime assets (public, config) if needed
# COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
