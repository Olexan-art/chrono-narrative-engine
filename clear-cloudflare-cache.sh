#!/bin/bash

# Cloudflare Cache Purge Script
# This script purges Cloudflare cache for the entire site or specific paths
# Usage:
#   ./clear-cloudflare-cache.sh              # Purge entire cache
#   ./clear-cloudflare-cache.sh /wiki/*      # Purge specific path pattern

# ⚠️  Set these environment variables before running:
# export CF_ZONE_ID="your_cloudflare_zone_id"
# export CF_API_TOKEN="your_cloudflare_api_token"

if [ -z "$CF_ZONE_ID" ]; then
  echo "❌ Error: CF_ZONE_ID environment variable is not set"
  echo "Please set it with: export CF_ZONE_ID='your_zone_id'"
  exit 1
fi

if [ -z "$CF_API_TOKEN" ]; then
  echo "❌ Error: CF_API_TOKEN environment variable is not set"
  echo "Please set it with: export CF_API_TOKEN='your_api_token'"
  exit 1
fi

DOMAIN="https://bravennow.com"

if [ -z "$1" ]; then
  # Purge everything
  echo "🧹 Purging entire Cloudflare cache for zone ${CF_ZONE_ID}..."
  
  RESPONSE=$(curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}')
  
  echo "$RESPONSE" | jq '.'
  
  if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo "✅ Cloudflare cache purged successfully!"
  else
    echo "❌ Failed to purge cache"
    exit 1
  fi
else
  # Purge specific URLs
  PATTERN="$1"
  echo "🧹 Purging Cloudflare cache for pattern: ${PATTERN}..."
  
  # Convert pattern to full URLs
  # For example: /wiki/* -> https://bravennow.com/wiki/*
  URLS="[\"${DOMAIN}${PATTERN}\"]"
  
  echo "URLs to purge: $URLS"
  
  RESPONSE=$(curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"files\":${URLS}}")
  
  echo "$RESPONSE" | jq '.'
  
  if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo "✅ Cloudflare cache purged for ${PATTERN}!"
  else
    echo "❌ Failed to purge cache"
    exit 1
  fi
fi
