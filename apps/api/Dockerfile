# LifeOS API — production image (phase 36). Multi-stage: build the workspace, then ship
# a lean runtime. Build from the REPO ROOT so the pnpm workspace is in context:
#   docker build -f apps/api/Dockerfile -t lifeos-api .

FROM node:20-slim AS build
WORKDIR /repo
RUN corepack enable
# Copy manifests first for cached installs.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lifeos/api... build

FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
RUN corepack enable
COPY --from=build /repo ./
WORKDIR /repo/apps/api
EXPOSE 3000
# Run pending migrations, then start (a real deploy runs migrate as a separate step).
CMD ["node", "dist/main.js"]
