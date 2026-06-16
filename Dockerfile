# syntax=docker/dockerfile:1

# ---- Build stage: compile the Vite frontend into /app/dist ----
FROM node:20-alpine AS build
WORKDIR /app
# Install all deps (including dev) — Vite/esbuild are devDependencies and
# are required to run `npm run build`.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage: Express serves /dist and proxies /api ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
# Only production deps are needed to run the server (express); skip devDeps
# so the runtime image stays small.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Copy the server and the built frontend from the build stage.
COPY server.js ./
COPY --from=build /app/dist ./dist
# Run as the unprivileged built-in `node` user, not root.
USER node
EXPOSE 3001
# Container is healthy once the server serves the app shell.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3001/ || exit 1
CMD ["node", "server.js"]
