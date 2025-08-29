#!/bin/bash

# Fix all imports from @/lib/supabase/server to @/lib/supabase/server
find /root/amzatlas/src/app/api -name "*.ts" -type f -exec sed -i "s|from '@/lib/supabase/server'|from '@/lib/supabase/server'|g" {} +

echo "Fixed all imports"