FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy public directory if it exists
COPY --from=builder /app/public* ./public/

# Copy other necessary files
COPY --from=builder /app/src ./src
COPY --from=builder /app/supabase ./supabase

EXPOSE 3000

CMD ["npm", "start"]