# Use Bun official image
FROM oven/bun:1-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    curl \
    iputils \
    bind-tools

# Copy package files
COPY package*.json ./
COPY bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application code
COPY . .

# Build the application
RUN bun run build

# Create data directory
RUN mkdir -p /app/data/cache

# Ensure config.json exists (it should be copied from the host)
RUN ls -la config/

# Set environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Expose health check port
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Startup command
CMD ["bun", "dist/daemon.js", "start"]