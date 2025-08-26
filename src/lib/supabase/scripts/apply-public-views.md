# Apply Public Views Migration

Since the `sqp` schema is not exposed by default in Supabase, we need to create views in the public schema.

## Run this migration

Go to your [Supabase SQL Editor](https://supabase.com/dashboard/project/unkdghonqrxplvjxeotl/sql) and run:

```sql
-- Copy and paste the contents of:
-- src/lib/supabase/migrations/003_create_public_views.sql
```

This will create public views that reference the sqp schema tables, allowing the Supabase client to access them.

## Alternative: Expose the sqp schema

If you prefer to use the sqp schema directly:

1. Go to [API Settings](https://supabase.com/dashboard/project/unkdghonqrxplvjxeotl/settings/api)
2. Find "Exposed schemas"
3. Add `sqp` to the list
4. Save and wait for the API to restart

Then update the client code to use `sqp.table_name` format.