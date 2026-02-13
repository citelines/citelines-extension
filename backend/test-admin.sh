#!/bin/bash
# Test script for admin moderation endpoints
# Usage: ./test-admin.sh <admin-user-id> <target-user-id> <citation-token>

BASE_URL="https://youtube-annotator-production.up.railway.app"

# You need to get a JWT token or anonymous ID for an admin user
# For testing, use your anonymous ID
ADMIN_ID="${1:-YOUR_ANONYMOUS_ID_HERE}"

echo "=== Testing Admin Moderation Endpoints ==="
echo ""

# Test 1: List all users
echo "1. List all users:"
curl -X GET "${BASE_URL}/api/admin/users" \
  -H "X-Anonymous-ID: ${ADMIN_ID}" \
  | jq '.'

echo ""
echo ""

# Test 2: List all citations
echo "2. List all citations:"
curl -X GET "${BASE_URL}/api/admin/citations" \
  -H "X-Anonymous-ID: ${ADMIN_ID}" \
  | jq '.'

echo ""
echo ""

# Test 3: Suspend a user
if [ ! -z "$2" ]; then
  echo "3. Suspend user $2 for 7 days:"
  curl -X POST "${BASE_URL}/api/admin/users/$2/suspend" \
    -H "X-Anonymous-ID: ${ADMIN_ID}" \
    -H "Content-Type: application/json" \
    -d '{"duration": 7, "reason": "Testing suspension"}' \
    | jq '.'

  echo ""
  echo ""
fi

# Test 4: Delete a citation
if [ ! -z "$3" ]; then
  echo "4. Delete citation $3:"
  curl -X DELETE "${BASE_URL}/api/admin/citations/$3" \
    -H "X-Anonymous-ID: ${ADMIN_ID}" \
    -H "Content-Type: application/json" \
    -d '{"reason": "Testing admin delete"}' \
    | jq '.'

  echo ""
  echo ""
fi

# Test 5: View audit log
echo "5. View audit log:"
curl -X GET "${BASE_URL}/api/admin/actions" \
  -H "X-Anonymous-ID: ${ADMIN_ID}" \
  | jq '.'

echo ""
echo "=== Tests Complete ==="
