# ABOUTME: Dockerfile for the texture compressor service.
# ABOUTME: Includes ffmpeg, imagemagick, and libwebp for image processing.

# Force x86_64 for texture-compressor binaries
FROM --platform=linux/amd64 node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm install

# Copy source
COPY compressor/ ./compressor/
COPY common/ ./common/

# Production stage
FROM --platform=linux/amd64 node:20-slim

# Install runtime dependencies for image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    imagemagick \
    webp \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy package.json for module resolution
COPY package*.json ./

# Copy compressor source
COPY compressor/ ./compressor/
COPY common/ ./common/

# Create cache directory
RUN mkdir -p /tmp/generated

# Expose default port (8080 for App Platform compatibility)
EXPOSE 8080

# Run the compressor
CMD ["node", "--import", "tsx", "compressor/src/index.ts"]
