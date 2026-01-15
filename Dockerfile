# Director Protocol Sandboxed Environment
# Multi-agent orchestration with container-based isolation

# Base image with Node.js and system dependencies
FROM node:22-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    git \
    docker \
    docker-compose \
    bash \
    curl \
    jq \
    procps \
    coreutils \
    findutils \
    util-linux

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S director -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY canvas/package*.json ./canvas/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY --chown=director:nodejs . .

# Create necessary directories and set permissions
RUN mkdir -p /tmp/director-sandboxes /var/log/director /app/registry/sessions \
    && chown -R director:nodejs /tmp/director-sandboxes /var/log/director /app/registry

# Switch to non-root user
USER director

# Expose ports for monitoring
EXPOSE 3000 8080 9229

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('fs').existsSync('/app/registry/sessions')" || exit 1

# Default command
CMD ["node", "src/cli.ts", "interactive"]