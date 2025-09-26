#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "AL Object ID Ninja MCP - Release Check"
echo "========================================"
echo

echo -e "${YELLOW}[1/6]${NC} Cleaning dist folder..."
if [ -d "dist" ]; then
    rm -rf dist
    echo -e "      ${GREEN}Cleaned!${NC}"
else
    echo -e "      ${GREEN}Already clean!${NC}"
fi
echo

echo -e "${YELLOW}[2/6]${NC} Running TypeScript type check..."
if npm run typecheck; then
    echo -e "      ${GREEN}Type check passed!${NC}"
else
    echo -e "${RED}ERROR: TypeScript type check failed!${NC}"
    exit 1
fi
echo

echo -e "${YELLOW}[3/6]${NC} Running ESLint..."
if npm run lint; then
    echo -e "      ${GREEN}Linting passed!${NC}"
else
    echo -e "${RED}ERROR: Linting failed!${NC}"
    exit 1
fi
echo

echo -e "${YELLOW}[4/6]${NC} Running tests..."
if npm test; then
    echo -e "      ${GREEN}Tests passed!${NC}"
else
    echo -e "${RED}ERROR: Tests failed!${NC}"
    exit 1
fi
echo

echo -e "${YELLOW}[5/6]${NC} Building project..."
if npm run build; then
    echo -e "      ${GREEN}Build successful!${NC}"
else
    echo -e "${RED}ERROR: Build failed!${NC}"
    exit 1
fi
echo

echo -e "${YELLOW}[6/6]${NC} Verifying build output..."
if [ -f "dist/v2/server.js" ]; then
    echo -e "      ${GREEN}Build output verified!${NC}"
else
    echo -e "      ${RED}ERROR: Build output not found!${NC}"
    exit 1
fi
echo

echo "========================================"
echo -e "${GREEN}✓ ALL CHECKS PASSED!${NC}"
echo "========================================"
echo
echo "Ready for release. Next steps:"
echo "  1. Commit your changes: git add -A && git commit -m \"Release v2.0.1\""
echo "  2. Tag the release: git tag v2.0.1"
echo "  3. Push to GitHub: git push origin master --tags"
echo "  4. Publish to npm: npm publish"
echo