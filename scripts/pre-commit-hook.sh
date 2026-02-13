#!/bin/bash
#
# Pre-commit hook to detect exposed credentials
# Prevents committing sensitive information to git
#

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Scanning for exposed credentials..."

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  echo "✅ No files to check"
  exit 0
fi

# Flag to track if credentials found
CREDENTIALS_FOUND=0

# Patterns to detect (case-insensitive)
declare -a PATTERNS=(
  # Database connection strings
  "postgresql://[^:]+:[^@]+@"
  "mysql://[^:]+:[^@]+@"
  "mongodb://[^:]+:[^@]+@"
  "postgres://[^:]+:[^@]+@"

  # Generic password patterns
  "password\s*=\s*['\"][^'\"]{8,}['\"]"
  "PASSWORD\s*=\s*['\"][^'\"]{8,}['\"]"

  # API keys and tokens (long alphanumeric strings)
  "api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9]{20,}['\"]"
  "API[_-]?KEY\s*[:=]\s*['\"][A-Za-z0-9]{20,}['\"]"
  "secret[_-]?key\s*[:=]\s*['\"][A-Za-z0-9]{20,}['\"]"
  "SECRET[_-]?KEY\s*[:=]\s*['\"][A-Za-z0-9]{20,}['\"]"

  # JWT tokens
  "eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"

  # AWS credentials
  "AKIA[0-9A-Z]{16}"
  "aws_access_key_id\s*=\s*[A-Z0-9]{20}"
  "aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}"

  # Private keys
  "BEGIN.*PRIVATE KEY"

  # Railway-specific (gondola is Railway's proxy)
  "gondola\.proxy\.rlwy\.net"

  # The specific exposed password (should be rotated, but catch it anyway)
  "***REMOVED***"
)

# Check each staged file
for FILE in $STAGED_FILES; do
  # Skip deleted files
  if [ ! -f "$FILE" ]; then
    continue
  fi

  # Skip binary files and common safe patterns
  if file "$FILE" | grep -qE 'executable|binary'; then
    continue
  fi

  # Skip node_modules and other safe directories
  if echo "$FILE" | grep -qE '^(node_modules|\.git|dist|build)/'; then
    continue
  fi

  # Check each pattern
  for PATTERN in "${PATTERNS[@]}"; do
    # Use git diff to check staged content (not working directory)
    if git diff --cached "$FILE" | grep -iE "$PATTERN" > /dev/null; then
      if [ $CREDENTIALS_FOUND -eq 0 ]; then
        echo ""
        echo -e "${RED}❌ CREDENTIALS DETECTED${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
      fi

      CREDENTIALS_FOUND=1

      echo -e "${YELLOW}File:${NC} $FILE"

      # Show the problematic line(s) without revealing full credential
      git diff --cached "$FILE" | grep -iE "$PATTERN" | sed 's/^/  /'
      echo ""
    fi
  done
done

# If credentials found, block the commit
if [ $CREDENTIALS_FOUND -eq 1 ]; then
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${RED}🚫 COMMIT BLOCKED${NC}"
  echo ""
  echo "Your commit contains potential credentials or sensitive data."
  echo ""
  echo "Actions you can take:"
  echo "  1. Remove the credentials from the file"
  echo "  2. Use environment variables instead (e.g., process.env.DATABASE_URL)"
  echo "  3. Add the file to .gitignore if it should never be committed"
  echo "  4. If this is a false positive, you can bypass with:"
  echo "     git commit --no-verify"
  echo ""
  echo -e "${YELLOW}⚠️  Use --no-verify ONLY if you're certain the file is safe${NC}"
  echo ""
  exit 1
fi

# Success
echo "✅ No credentials detected - commit allowed"
exit 0
