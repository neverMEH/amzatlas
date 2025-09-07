#!/bin/bash

# Script to apply BigQuery schema migrations in the correct order
# This handles the special case where period_comparisons is a view

echo "Applying BigQuery schema migrations..."

# Set the migrations directory
MIGRATIONS_DIR="src/lib/supabase/migrations"

# Check if we're in the correct directory
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Error: Migrations directory not found. Please run from the project root."
    exit 1
fi

# Function to run a migration
run_migration() {
    local migration_file=$1
    echo "Running migration: $migration_file"
    
    # You can use one of these methods:
    # Method 1: Using psql (requires DATABASE_URL)
    # psql $DATABASE_URL -f "$MIGRATIONS_DIR/$migration_file"
    
    # Method 2: Using Supabase CLI (requires supabase project setup)
    # supabase db push --file "$MIGRATIONS_DIR/$migration_file"
    
    # Method 3: Manual instruction
    echo "Please run the following migration manually in your Supabase SQL editor:"
    echo "  $MIGRATIONS_DIR/$migration_file"
    echo ""
}

echo "=== Step 1: Apply main schema changes ==="
run_migration "013_restructure_for_bigquery_schema.sql"

echo "=== Step 2: Update views with cart add columns ==="
run_migration "014_update_period_comparisons_view.sql"

echo ""
echo "Migration plan complete!"
echo ""
echo "To apply these migrations:"
echo "1. Go to your Supabase project dashboard"
echo "2. Navigate to SQL Editor"
echo "3. Run each migration file in the order shown above"
echo ""
echo "Or use the Supabase CLI:"
echo "  supabase db push --file src/lib/supabase/migrations/013_restructure_for_bigquery_schema.sql"
echo "  supabase db push --file src/lib/supabase/migrations/014_update_period_comparisons_view.sql"