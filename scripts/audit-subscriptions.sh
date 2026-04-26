#!/bin/bash

# Script to audit Angular components for proper subscription management
# Checks for subscribe() calls without takeUntilDestroyed()

echo "🔍 Auditing Angular Components for Subscription Management"
echo "=========================================================="
echo ""

# Find all TypeScript component files
COMPONENT_FILES=$(find src/app -name "*.component.ts" -o -name "*.ts" | grep -E "(component|service)\.ts$")

TOTAL_FILES=0
FILES_WITH_SUBSCRIBE=0
FILES_WITHOUT_TAKEUNTIL=0
ISSUES_FOUND=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📋 Checking files for subscription management..."
echo ""

for file in $COMPONENT_FILES; do
  TOTAL_FILES=$((TOTAL_FILES + 1))
  
  # Check if file contains .subscribe(
  if grep -q "\.subscribe(" "$file"; then
    FILES_WITH_SUBSCRIBE=$((FILES_WITH_SUBSCRIBE + 1))
    
    # Check if file uses takeUntilDestroyed
    if ! grep -q "takeUntilDestroyed" "$file"; then
      FILES_WITHOUT_TAKEUNTIL=$((FILES_WITHOUT_TAKEUNTIL + 1))
      echo -e "${RED}❌ ISSUE:${NC} $file"
      echo "   Contains .subscribe() but missing takeUntilDestroyed()"
      
      # Show line numbers with subscribe calls
      grep -n "\.subscribe(" "$file" | head -5 | while read line; do
        echo "   Line: $line"
      done
      echo ""
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
      echo -e "${GREEN}✅ OK:${NC} $file"
    fi
  fi
done

echo ""
echo "=========================================================="
echo "📊 Audit Summary"
echo "=========================================================="
echo "Total files scanned: $TOTAL_FILES"
echo "Files with subscriptions: $FILES_WITH_SUBSCRIBE"
echo -e "${RED}Files missing takeUntilDestroyed: $FILES_WITHOUT_TAKEUNTIL${NC}"
echo ""

if [ $ISSUES_FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ All components properly manage subscriptions!${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Found $ISSUES_FOUND files with subscription management issues${NC}"
  echo ""
  echo "📝 Recommended Actions:"
  echo "1. Add 'private readonly destroyRef = inject(DestroyRef);' to component"
  echo "2. Import: import { takeUntilDestroyed } from '@angular/core/rxjs-interop';"
  echo "3. Pipe all observables: .pipe(takeUntilDestroyed(this.destroyRef))"
  exit 1
fi
