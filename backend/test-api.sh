#!/bin/bash

# YouTube Annotator Backend API Test Script

API_URL="http://localhost:3000/api"
ANONYMOUS_ID=""
SHARE_TOKEN=""

echo "====================================="
echo "YouTube Annotator API Test"
echo "====================================="
echo ""

# Test 1: Health Check
echo "1. Testing health endpoint..."
HEALTH=$(curl -s "${API_URL}/health")
echo "Response: $HEALTH"
echo ""

# Test 2: Register Anonymous User
echo "2. Registering anonymous user..."
REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register")
echo "Response: $REGISTER_RESPONSE"
ANONYMOUS_ID=$(echo $REGISTER_RESPONSE | grep -o '"anonymousId":"[^"]*' | cut -d'"' -f4)
echo "Anonymous ID: $ANONYMOUS_ID"
echo ""

# Test 3: Verify Anonymous ID
echo "3. Verifying anonymous ID..."
VERIFY_RESPONSE=$(curl -s -H "X-Anonymous-ID: $ANONYMOUS_ID" "${API_URL}/auth/verify")
echo "Response: $VERIFY_RESPONSE"
echo ""

# Test 4: Create Share
echo "4. Creating a share..."
CREATE_SHARE_RESPONSE=$(curl -s -X POST "${API_URL}/shares" \
  -H "Content-Type: application/json" \
  -H "X-Anonymous-ID: $ANONYMOUS_ID" \
  -d '{
    "videoId": "dQw4w9WgXcQ",
    "title": "Test Share",
    "annotations": [
      {"timestamp": 30, "text": "First annotation at 30 seconds"},
      {"timestamp": 60, "text": "Second annotation at 1 minute"},
      {"timestamp": 120, "text": "Third annotation at 2 minutes"}
    ]
  }')
echo "Response: $CREATE_SHARE_RESPONSE"
SHARE_TOKEN=$(echo $CREATE_SHARE_RESPONSE | grep -o '"shareToken":"[^"]*' | cut -d'"' -f4)
echo "Share Token: $SHARE_TOKEN"
echo ""

# Test 5: Get Share (Public)
echo "5. Getting share (public access)..."
GET_SHARE_RESPONSE=$(curl -s "${API_URL}/shares/$SHARE_TOKEN")
echo "Response: $GET_SHARE_RESPONSE"
echo ""

# Test 6: Browse Shares for Video
echo "6. Browsing shares for video..."
BROWSE_RESPONSE=$(curl -s "${API_URL}/shares/video/dQw4w9WgXcQ")
echo "Response: $BROWSE_RESPONSE"
echo ""

# Test 7: Get My Shares
echo "7. Getting my shares..."
MY_SHARES_RESPONSE=$(curl -s -H "X-Anonymous-ID: $ANONYMOUS_ID" "${API_URL}/shares/me")
echo "Response: $MY_SHARES_RESPONSE"
echo ""

# Test 8: Update Share
echo "8. Updating share..."
UPDATE_RESPONSE=$(curl -s -X PUT "${API_URL}/shares/$SHARE_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Anonymous-ID: $ANONYMOUS_ID" \
  -d '{
    "title": "Updated Test Share"
  }')
echo "Response: $UPDATE_RESPONSE"
echo ""

# Test 9: Delete Share (commented out to preserve test data)
# echo "9. Deleting share..."
# DELETE_RESPONSE=$(curl -s -X DELETE "${API_URL}/shares/$SHARE_TOKEN" \
#   -H "X-Anonymous-ID: $ANONYMOUS_ID")
# echo "Response: $DELETE_RESPONSE"
# echo ""

echo "====================================="
echo "Test Complete!"
echo "====================================="
echo ""
echo "Summary:"
echo "- Anonymous ID: $ANONYMOUS_ID"
echo "- Share Token: $SHARE_TOKEN"
echo "- Share URL: https://youtube.com/watch?v=dQw4w9WgXcQ&share=$SHARE_TOKEN"
echo ""
echo "You can test the share URL in Chrome with the extension loaded!"
