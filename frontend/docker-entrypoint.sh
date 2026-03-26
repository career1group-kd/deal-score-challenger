#!/bin/sh
set -e

# Default to Docker Compose-style name if not set
: "${BACKEND_URL:=http://backend:8000}"

# Substitute ONLY $BACKEND_URL — preserve nginx's own $host, $uri, etc.
envsubst '$BACKEND_URL' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
