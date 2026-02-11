#!/bin/bash

SUPABASE_URL="https://bgdwxnoildvvepsoaxrf.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZHd4bm9pbGR2dmVwc29heHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTM2MzQsImV4cCI6MjA4NDc2OTYzNH0.FaLsz1zWVZMLCWizBnKG1ARFFO3N_I1Vmri9xMVVXFk"

echo "Fetching cached pages..."
RESPONSE=$(curl -s "${SUPABASE_URL}/rest/v1/cached_pages?select=path&limit=100" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

echo "Response: $RESPONSE"

# Extract paths and delete one by one
echo "$RESPONSE" | jq -r '.[].path' | while read -r path; do
  echo "Deleting cache for: $path"
  curl -X DELETE "${SUPABASE_URL}/rest/v1/cached_pages?path=eq.${path}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}"
  sleep 0.5
done

echo "Cache cleared!"
