#!/bin/bash

# Script to update Supabase Edge Functions environment variables
# This script requires Supabase CLI to be installed

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔧 Supabase Edge Functions Environment Setup${NC}\n"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo -e "Please install Supabase CLI first:"
    echo -e "  npm install -g supabase"
    echo -e "  or visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Load environment variables from .env
if [ -f ".env" ]; then
    echo -e "${GREEN}📋 Loading environment variables from .env...${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Check if required variables are set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ SUPABASE_SERVICE_ROLE_KEY not found in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Service role key found in .env (${#SUPABASE_SERVICE_ROLE_KEY} chars)${NC}\n"

echo -e "${YELLOW}📤 Setting SUPABASE_SERVICE_ROLE_KEY in edge functions environment...${NC}"

# Set the service role key in Supabase edge functions
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully set SUPABASE_SERVICE_ROLE_KEY in edge functions${NC}"
else
    echo -e "${RED}❌ Failed to set environment variable${NC}"
    echo -e "Please check:"
    echo -e "  1. Supabase CLI is logged in (supabase auth login)"
    echo -e "  2. Project is linked (supabase link)"
    exit 1
fi

echo -e "\n${YELLOW}📋 Current edge functions secrets:${NC}"
supabase secrets list

echo -e "\n${GREEN}🎉 Setup complete!${NC}"
echo -e "Edge functions should now have access to the correct SERVICE_ROLE_KEY."
echo -e "Cron jobs should start working within a few minutes."
echo -e "\nTo verify, run: ${YELLOW}node show-cron-status.mjs${NC}"