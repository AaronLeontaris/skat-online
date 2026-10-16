# Skat Online — server image. Builds the client bundle, then serves it + the Socket.IO API.
FROM node:22-alpine

WORKDIR /app

# Pin pnpm to match the version used to generate the lockfile.
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @skat/client run build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["pnpm", "--filter", "@skat/server", "run", "start"]
