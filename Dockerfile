FROM node:22-alpine AS builder

RUN apk add --no-cache \
    build-base \
    pkgconf \
    python3 \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev

WORKDIR /build

COPY package*.json ./
RUN npm i

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build && npm prune --production

FROM node:22-alpine

RUN apk add --no-cache \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    pixman \
    ffmpeg \
    curl

WORKDIR /app

COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist        ./dist

COPY public/ ./public/

RUN mkdir -p /app/output && chmod 777 /app/output

ENV NODE_ENV=production
ENV OUTPUT_DIR=/app/output

CMD ["node", "dist/index.js"]