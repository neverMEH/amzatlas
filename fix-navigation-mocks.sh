#!/bin/bash

# List of files that have duplicate next/navigation mocks
files=(
    "src/app/keyword-analysis/__tests__/page.test.tsx"
    "src/app/__tests__/page.current-date.test.tsx"
    "src/app/keyword-analysis/__tests__/page.current-date.test.tsx"
    "src/components/asin-performance/__tests__/KeywordMarketShare.enhanced.test.tsx"
    "src/app/keyword-analysis/__tests__/date-range-selection.test.tsx"
    "src/app/__tests__/page.asin-date-integration.test.tsx"
    "src/hooks/__tests__/use-view-mode.test.ts"
    "src/tests/responsive/enhanced-dashboard-mobile.test.tsx"
    "src/tests/responsive/mobile-optimization.test.tsx"
    "src/tests/navigation/sidebar-navigation.test.tsx"
    "src/tests/dashboard/enhanced-dashboard-integration.test.tsx"
    "src/tests/dashboard/enhanced-dashboard-layout.test.tsx"
    "src/tests/navigation/breadcrumb.test.tsx"
    "src/tests/layout/application-shell.test.tsx"
)

# Function to remove navigation mocks from a file
remove_navigation_mock() {
    local file="$1"
    echo "Processing: $file"
    
    # Use perl to remove the vi.mock('next/navigation') block, handling multiline
    perl -i -0pe "s/\/\/ Mock next\/navigation.*?vi\.mock\('next\/navigation'.*?\}\)\)\n\n//gs" "$file"
    perl -i -0pe "s/vi\.mock\('next\/navigation'.*?\}\)\)\n\n//gs" "$file"
    perl -i -0pe "s/vi\.mock\('next\/navigation'.*?\}\)\)//gs" "$file"
    
    # Also remove standalone mock definitions
    perl -i -0pe "s/const mockRouter = \{[^}]*\}\n\n//gs" "$file"
    perl -i -0pe "s/const mockUseRouter = vi\.fn.*?\n\n//gs" "$file"
}

# Process all files
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        remove_navigation_mock "$file"
    else
        echo "File not found: $file"
    fi
done

echo "Navigation mocks cleanup complete!"