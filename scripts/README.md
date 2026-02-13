# Development Scripts

## Git Hooks Installation

### Quick Start

After cloning the repository, run:

```bash
./scripts/install-hooks.sh
```

This installs a pre-commit hook that scans for exposed credentials.

### What Gets Installed

**Pre-commit Hook** (`pre-commit-hook.sh`)
- Scans staged files for credentials before each commit
- Blocks commits containing database URLs, API keys, passwords, etc.
- Prevents GitGuardian alerts and security incidents

### Manual Installation

If you prefer to install manually:

```bash
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Testing the Hook

**Test that it blocks credentials**:
```bash
# Create file with fake database URL (will be blocked by hook)
echo 'DATABASE_URL=postgresql://USER:PASS@HOST/DB' > test.txt
git add test.txt
git commit -m "Test"
# Should be BLOCKED ❌

git reset HEAD test.txt
rm test.txt
```

**Test that it allows safe commits**:
```bash
echo 'Safe content' > test.txt
git add test.txt
git commit -m "Test"
# Should be ALLOWED ✅

git reset --soft HEAD~1
git reset HEAD test.txt
rm test.txt
```

### Documentation

See `.git/hooks/README.md` (created after hook installation) for:
- Detected patterns
- How to bypass (when safe)
- False positive handling
- Best practices

---

## Other Scripts

*(None yet - add future scripts here)*
