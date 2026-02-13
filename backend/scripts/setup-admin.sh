#!/bin/bash
#
# Setup Admin Account for YouTube Annotator
# This script helps create an admin account with email/password auth
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

API_URL="https://youtube-annotator-production.up.railway.app"

echo ""
echo "========================================="
echo "YouTube Annotator - Admin Setup"
echo "========================================="
echo ""

# Get admin credentials
read -p "Admin email: " ADMIN_EMAIL
read -sp "Admin password: " ADMIN_PASSWORD
echo ""
read -p "Display name (default: Admin): " DISPLAY_NAME
DISPLAY_NAME=${DISPLAY_NAME:-Admin}

echo ""
echo -e "${YELLOW}Step 1: Registering admin account...${NC}"

# Register
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register-email" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"displayName\": \"$DISPLAY_NAME\"
  }")

echo "$REGISTER_RESPONSE" | jq '.'

USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.userId // .user.id // empty')

if [ -z "$USER_ID" ]; then
  echo -e "${RED}❌ Registration failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Account registered: $USER_ID${NC}"
echo ""

# Get verification token from Railway logs
echo -e "${YELLOW}Step 2: Finding verification URL in Railway logs...${NC}"
echo ""
echo "Checking Railway logs (this may take a moment)..."

# Wait a bit for logs to appear
sleep 3

# Try to get verification URL from logs
VERIFICATION_URL=$(railway logs --tail 50 | grep -oE "https://[^[:space:]]+/api/auth/verify-email\?token=[^[:space:]]+" | tail -1)

if [ -z "$VERIFICATION_URL" ]; then
  echo -e "${RED}❌ Could not find verification URL in logs${NC}"
  echo ""
  echo "Manual steps:"
  echo "1. Run: railway logs --tail 100 | grep 'Verification URL'"
  echo "2. Copy the URL"
  echo "3. Visit it in your browser or curl it"
  echo "4. Then run: $0 --verify"
  exit 1
fi

echo -e "${GREEN}✅ Found verification URL${NC}"
echo ""

# Verify email
echo -e "${YELLOW}Step 3: Verifying email...${NC}"
VERIFY_RESPONSE=$(curl -s "$VERIFICATION_URL")
echo "$VERIFY_RESPONSE" | jq '.'

if echo "$VERIFY_RESPONSE" | grep -q "verified successfully"; then
  echo -e "${GREEN}✅ Email verified${NC}"
else
  echo -e "${RED}❌ Email verification failed${NC}"
  exit 1
fi

echo ""

# Login
echo -e "${YELLOW}Step 4: Logging in to get JWT token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')

if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo ""
echo "JWT Token:"
echo "$JWT_TOKEN"
echo ""

# Set admin flag
echo -e "${YELLOW}Step 5: Setting admin flag in database...${NC}"
railway run psql \$DATABASE_URL -c "UPDATE users SET is_admin = true WHERE email = '$ADMIN_EMAIL';"

# Verify admin flag
echo ""
echo "Verifying admin status..."
railway run psql \$DATABASE_URL -c "SELECT email, display_name, is_admin, email_verified FROM users WHERE email = '$ADMIN_EMAIL';"

echo ""
echo -e "${GREEN}✅ Admin setup complete!${NC}"
echo ""
echo "========================================="
echo "Admin Credentials"
echo "========================================="
echo "Email: $ADMIN_EMAIL"
echo "JWT Token: $JWT_TOKEN"
echo ""
echo "Export token for easy use:"
echo "  export ADMIN_JWT=\"$JWT_TOKEN\""
echo ""
echo "Test admin access:"
echo "  curl $API_URL/api/admin/users -H \"Authorization: Bearer \$ADMIN_JWT\""
echo ""
