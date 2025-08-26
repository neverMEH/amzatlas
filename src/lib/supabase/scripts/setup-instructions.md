# Supabase Setup Instructions

Your Supabase connection is configured and working! Now you need to run the migrations to create the database schema.

## Quick Setup Steps

### 1. Install Supabase CLI (recommended)

```bash
# macOS
brew install supabase/tap/supabase

# Linux
brew install supabase/tap/supabase

# Windows (via scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 2. Run Migrations

#### Option A: Using Supabase Dashboard (Easiest)

1. Go to: https://supabase.com/dashboard/project/unkdghonqrxplvjxeotl/sql
2. Click "New query"
3. Copy and paste each SQL file in order:
   - First: `src/lib/supabase/migrations/001_create_sqp_tables.sql`
   - Then: `src/lib/supabase/migrations/002_create_sqp_views.sql`
4. Click "Run" for each

#### Option B: Using Supabase CLI

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref unkdghonqrxplvjxeotl

# Run migrations
supabase db execute -f src/lib/supabase/migrations/001_create_sqp_tables.sql
supabase db execute -f src/lib/supabase/migrations/002_create_sqp_views.sql
```

### 3. Verify Tables Were Created

After running migrations, test again:

```bash
npx tsx src/lib/supabase/scripts/test-connection.ts
```

You should see "Tables exist and are accessible" instead of the error.

## Your Supabase Project Details

- **Project URL**: https://unkdghonqrxplvjxeotl.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/unkdghonqrxplvjxeotl
- **SQL Editor**: https://supabase.com/dashboard/project/unkdghonqrxplvjxeotl/sql