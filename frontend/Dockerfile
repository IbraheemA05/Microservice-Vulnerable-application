# Frontend Dockerfile - Nginx to serve static files
FROM nginx:alpine

# Copy static files to nginx html directory
COPY . /usr/share/nginx/html

# Copy custom nginx config (optional, for SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1
