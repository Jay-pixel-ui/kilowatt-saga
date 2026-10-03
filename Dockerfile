# GRAPNEL — single-process deploy: serves the built client AND the
# Colyseus websocket on one port (PORT env or 2567).
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 2567
CMD ["npm", "run", "start"]
