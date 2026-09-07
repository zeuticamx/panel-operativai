# syntax=docker/dockerfile:1

# ---- deps: instala dependencias con el lockfile ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compila en modo standalone (next.config.ts: output: "standalone") ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Las variables NEXT_PUBLIC_* se hornean en el bundle del cliente durante el
# build, no se leen en runtime: hay que pasarlas como build args desde
# EasyPanel (Build Args), no como variables de entorno del servicio.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_META_APP_ID
ARG NEXT_PUBLIC_META_CONFIG_ID
ARG NEXT_PUBLIC_META_REDIRECT_URI
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_META_APP_ID=$NEXT_PUBLIC_META_APP_ID \
    NEXT_PUBLIC_META_CONFIG_ID=$NEXT_PUBLIC_META_CONFIG_ID \
    NEXT_PUBLIC_META_REDIRECT_URI=$NEXT_PUBLIC_META_REDIRECT_URI

RUN npm run build

# ---- runner: imagen final, solo lo necesario para correr ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# El output standalone ya trae su propio server.js y un node_modules mínimo;
# static y public quedan afuera de .next/standalone y se copian aparte.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
