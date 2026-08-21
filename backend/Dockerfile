# Base image
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies first (for caching)
COPY package*.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

# Copy built code from builder
COPY --from=builder /usr/src/app/dist ./dist
# Copy prisma client generated in builder
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 5000

CMD ["npm", "run", "start"]
