#!/bin/bash
#
# Install git hooks for citelines-extension
# Run this after cloning the repository
#

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"

if [ -z "$REPO_ROOT" ]; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

HOOKS_DIR="$REPO_ROOT/.git/hooks"
SCRIPT_DIR="$REPO_ROOT/scripts"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "🔧 Installing git hooks..."
echo ""

# Pre-commit hook (credential scanner)
if [ -f "$HOOKS_DIR/pre-commit" ]; then
  echo -e "${YELLOW}⚠️  pre-commit hook already exists${NC}"
  read -p "Overwrite? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping pre-commit hook"
  else
    cp "$SCRIPT_DIR/pre-commit-hook.sh" "$HOOKS_DIR/pre-commit"
    chmod +x "$HOOKS_DIR/pre-commit"
    echo -e "${GREEN}✅ Installed pre-commit hook (credential scanner)${NC}"
  fi
else
  cp "$SCRIPT_DIR/pre-commit-hook.sh" "$HOOKS_DIR/pre-commit"
  chmod +x "$HOOKS_DIR/pre-commit"
  echo -e "${GREEN}✅ Installed pre-commit hook (credential scanner)${NC}"
fi

echo ""
echo "🎉 Git hooks installation complete!"
echo ""
echo "The pre-commit hook will automatically scan for credentials before each commit."
echo "See .git/hooks/README.md for documentation."
echo ""
