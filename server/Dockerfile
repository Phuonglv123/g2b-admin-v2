# Claude Proxy Server Dockerfile
# Use full Node image instead of alpine for better native module support
FROM node:20-slim

# Install dependencies for sharp and other native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libvips42 \
    libvips-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies - use npm install instead of npm ci for better compatibility
RUN npm install --omit=dev

# Copy source code
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start server
CMD ["node", "index.js"]
