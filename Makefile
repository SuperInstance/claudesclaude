.PHONY: help commit test build clean lint format deploy

# Default target
help:
	@echo "Available targets:"
	@echo "  help        - Show this help message"
	@echo "  commit      - Commit all changes and push to GitHub"
	@echo "  test        - Run tests"
	@echo "  build       - Build the project"
	@echo "  clean       - Clean build artifacts"
	@echo "  lint        - Run linting"
	@echo "  format      - Format code"
	@echo "  deploy      - Build and commit changes"
	@echo "  status      - Show git status"
	@echo "  push        - Push current changes to GitHub"

# Commit all changes and push to GitHub
commit:
	@echo "=== Committing all changes ==="
	@./.github/scripts/auto-commit.sh

# Run tests
test:
	@echo "=== Running tests ==="
	@bun test

# Build the project
build:
	@echo "=== Building project ==="
	@npx tsc --noEmit
	@echo "Build completed"

# Clean build artifacts
clean:
	@echo "=== Cleaning build artifacts ==="
	@rm -rf dist/
	@echo "Clean completed"

# Run linting
lint:
	@echo "=== Running linting ==="
	@npx tsc --noEmit --strict
	@echo "Linting completed"

# Format code
format:
	@echo "=== Formatting code ==="
	@echo "Code formatting not implemented yet"

# Build and commit changes
deploy: build commit
	@echo "=== Deployment complete ==="

# Show git status
status:
	@echo "=== Git status ==="
	@git status

# Push current changes
push:
	@echo "=== Pushing to GitHub ==="
	@git push origin main