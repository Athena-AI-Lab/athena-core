FROM node:22
RUN apt-get update -qq && \
    apt-get install -y python3 python3-pip python-is-python3 && \
    npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm i --frozen-lockfile --prod=false
COPY . .
RUN pnpm build && pnpm prune --prod && rm -rf src
EXPOSE 3000
CMD ["pnpm", "fast-start"]
