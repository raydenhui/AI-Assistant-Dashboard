# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY index.html ./
COPY tsconfig*.json ./
COPY postcss.config.js tailwind.config.js vite.config.ts ./
COPY src ./src

RUN npm run build

# ── Serve stage ────────────────────────────────────────────────────────────────
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config: serve SPA and proxy /api to the backend server container
# SERVER_HOST is substituted at container start via envsubst
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
