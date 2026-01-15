#!/bin/bash

# Repository Status Verification Script
# Ensures the GitHub repository is current and synchronized

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Repository directory
REPO_DIR="/home/eileen/projects/claudesclaude"

# Change to repository directory
cd "$REPO_DIR"

echo -e "\n${BLUE}🔍 Repository Status Verification${NC}"
echo "=================================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not in a git repository"
    exit 1
fi

# Check git status
log_section "Git Status"
git status --porcelain

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log_warn "Uncommitted changes detected"
    echo -e "\n${YELLOW}📝 Changes to commit:${NC}"
    git diff --stat
    echo ""
    read -p "Do you want to commit these changes? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        make commit
    else
        log_warn "Changes not committed"
    fi
else
    log_info "Working tree clean - no changes to commit"
fi

# Check remote synchronization
log_section "Remote Status"
echo "Remote repository status:"
git remote -v
echo ""

# Check local vs remote commits
LOCAL_COMMITS=$(git rev-list --count HEAD)
REMOTE_COMMITS=$(git rev-list --count origin/main 2>/dev/null || echo "unknown")

echo "Local commits:  $LOCAL_COMMITS"
echo "Remote commits: $REMOTE_COMMITS"

if [[ "$REMOTE_COMMITS" != "unknown" ]] && [[ $LOCAL_COMMITS -gt $REMOTE_COMMITS ]]; then
    log_warn "Local repository is ahead of remote"
    echo ""
    read -p "Do you want to push changes to remote? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push origin main
        log_info "Changes pushed to remote"
    else
        log_warn "Changes not pushed"
    fi
elif [[ "$REMOTE_COMMITS" != "unknown" ]] && [[ $LOCAL_COMMITS -eq $REMOTE_COMMITS ]]; then
    log_info "Repository is synchronized with remote"
else
    log_warn "Unable to check remote status"
fi

# Check recent commits
log_section "Recent Activity"
echo "Last 5 commits:"
git log --oneline -5

# Check for any files that should be committed
log_section "File Status"
UNTRACKED=$(git ls-files --others --exclude-standard)
if [[ -n "$UNTRACKED" ]]; then
    echo -e "\n${YELLOW}⚠️  Untracked files:${NC}"
    echo "$UNTRACKED"
    echo ""
    read -p "Do you want to add and commit these files? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        make commit
    else
        log_warn "Untracked files not committed"
    fi
else
    log_info "No untracked files"
fi

log_section "Repository Health"
echo "Repository configuration:"
echo "  Branch: $(git branch --show-current)"
echo "  Remote: $(git remote get-url origin 2>/dev/null || echo 'none')"
echo "  Last commit: $(git log -1 --format='%h - %s (%cr)')"

# Check TypeScript compilation
echo ""
echo "TypeScript compilation check:"
if npx tsc --noEmit --skipLibCheck; then
    log_info "✅ TypeScript compilation successful"
else
    log_warn "❌ TypeScript compilation has errors"
fi

echo -e "\n${GREEN}✅ Repository status check complete${NC}"
echo "Use 'make commit' to commit any pending changes"
echo "Use 'make push' to push changes to GitHub"