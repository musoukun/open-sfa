FROM node:22-bookworm-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY web/package.json web/package-lock.json ./web/
RUN npm ci --prefix web

COPY . .

CMD ["sh", "-c", "npm run db:generate && npm run db:deploy && npm run build:web && npm run start"]
