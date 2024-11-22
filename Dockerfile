# Stage 1: Build Stage
FROM node:22-alpine AS builder

RUN apk update && apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && \
     yarn cache clean

# Copy source code
COPY . .

# Stage 2: Production Stage
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Create a non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only necessary files and node_modules from the builder stage with ownership set to appuser
COPY --from=builder /usr/bin/dumb-init /usr/bin/dumb-init
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json /app/yarn.lock ./
COPY --from=builder --chown=appuser:appgroup /app/src ./src
COPY --from=builder --chown=appuser:appgroup /app/.env.example ./.env

# Switch to the non-root user
USER appuser

# Define environment variables (can be overridden at runtime)
ENV NODE_ENV=production

# Start the application
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/index.mjs"]