# 1. Install dependencies with dev dependencies for prisma generate
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Generate Prisma client and build the app
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build argument for Next.js build-time public environment variables
ARG NEXT_PUBLIC_BASE_PATH
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# .env is excluded by .dockerignore, so create .env.production for Next.js
RUN echo "NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH" > .env.production && \
    if [ -n "$NEXT_PUBLIC_VAPID_PUBLIC_KEY" ]; then \
      echo "NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY" >> .env.production; \
    fi

RUN npx prisma generate
RUN echo ">>> Building with NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH" && npm run build

# 3. Production image
FROM node:20-alpine AS runner
WORKDIR /app

# Security best practices
ENV NODE_ENV=production
ARG NEXT_PUBLIC_BASE_PATH
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts

# Install PostgreSQL client tools for backup/restore functionality
RUN apk add --no-cache postgresql-client

USER nextjs
EXPOSE 3000

# Run migrations and start the app
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]