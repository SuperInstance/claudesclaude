#!/bin/bash

# Auto-commit script to ensure GitHub repo is always current
# This script checks for changes and automatically commits them

set -e

# Configuration
REPO_DIR="/home/eileen/projects/claudesclaude"
COMMIT_MESSAGE_FILE="/tmp/commit_message.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Change to repository directory
cd "$REPO_DIR"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not in a git repository"
    exit 1
fi

# Check if there are changes
if ! git diff-index --quiet HEAD --; then
    log_info "Changes detected, committing..."

    # Generate commit message
    echo "Auto-commit: $(date '+%Y-%m-%d %H:%M:%S')" > "$COMMIT_MESSAGE_FILE"
    echo "" >> "$COMMIT_MESSAGE_FILE"

    # Add file changes summary
    echo "Files modified:" >> "$COMMIT_MESSAGE_FILE"
    git diff --name-status >> "$COMMIT_MESSAGE_FILE"
    echo "" >> "$COMMIT_MESSAGE_FILE"

    # Add change summary
    echo "Change summary:" >> "$COMMIT_MESSAGE_FILE"
    git diff --stat >> "$COMMIT_MESSAGE_FILE"

    # Stage all changes
    git add .

    # Commit with generated message
    git commit -F "$COMMIT_MESSAGE_FILE"

    # Push to remote
    if git push origin main; then
        log_info "Changes committed and pushed successfully"
    else
        log_warn "Changes committed but push failed - manual push needed"
    fi

    # Clean up
    rm -f "$COMMIT_MESSAGE_FILE"
else
    log_info "No changes to commit"
fi