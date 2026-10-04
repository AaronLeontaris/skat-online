# Skat Online — server image. Runs the Socket.IO server via tsx (no compiled build step).
FROM node:22-alpine

WORKDIR /app

# Pin pnpm to match the version used to generate the lockfile.
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
EXPOSE 4000

CMD ["pnpm", "--filter", "@skat/server", "run", "start"]
