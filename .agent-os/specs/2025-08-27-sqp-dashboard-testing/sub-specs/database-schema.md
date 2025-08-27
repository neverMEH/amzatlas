# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-08-27-sqp-dashboard-testing/spec.md

> Created: 2025-08-27
> Version: 1.0.0

## Schema Changes

### 1. custom_views Table

Stores user-created custom views and saved queries.

```sql
CREATE TABLE custom_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    view_type VARCHAR(50) NOT NULL CHECK (view_type IN ('query', 'chart', 'table', 'dashboard')),
    configuration JSONB NOT NULL,
    filters JSONB,
    sort_config JSONB,
    is_public BOOLEAN DEFAULT false,
    is_template BOOLEAN DEFAULT false,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_custom_views_user_id ON custom_views(user_id);
CREATE INDEX idx_custom_views_type ON custom_views(view_type);
CREATE INDEX idx_custom_views_public ON custom_views(is_public) WHERE is_public = true;
CREATE INDEX idx_custom_views_template ON custom_views(is_template) WHERE is_template = true;
CREATE INDEX idx_custom_views_tags ON custom_views USING GIN(tags);
CREATE INDEX idx_custom_views_config ON custom_views USING GIN(configuration);
CREATE INDEX idx_custom_views_updated_at ON custom_views(updated_at DESC);
```

### 2. dashboard_layouts Table

Stores dashboard widget configurations and layout information.

```sql
CREATE TABLE dashboard_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout_config JSONB NOT NULL,
    widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
    grid_settings JSONB,
    theme_config JSONB,
    is_default BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false,
    shared_with UUID[], -- Array of user IDs
    permissions JSONB DEFAULT '{"read": true, "write": false, "admin": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_viewed_at TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_dashboard_layouts_user_id ON dashboard_layouts(user_id);
CREATE INDEX idx_dashboard_layouts_default ON dashboard_layouts(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_dashboard_layouts_shared ON dashboard_layouts(is_shared) WHERE is_shared = true;
CREATE INDEX idx_dashboard_layouts_widgets ON dashboard_layouts USING GIN(widgets);
CREATE INDEX idx_dashboard_layouts_shared_with ON dashboard_layouts USING GIN(shared_with);
CREATE INDEX idx_dashboard_layouts_updated_at ON dashboard_layouts(updated_at DESC);
```

### 3. report_cache Table

Stores processed report data for performance optimization.

```sql
CREATE TABLE report_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(512) NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    report_type VARCHAR(100) NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    parameters JSONB,
    result_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    row_count INTEGER,
    data_size_bytes INTEGER,
    execution_time_ms INTEGER,
    is_stale BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0
);

-- Indexes
CREATE UNIQUE INDEX idx_report_cache_key ON report_cache(cache_key);
CREATE INDEX idx_report_cache_user_id ON report_cache(user_id);
CREATE INDEX idx_report_cache_type ON report_cache(report_type);
CREATE INDEX idx_report_cache_hash ON report_cache(query_hash);
CREATE INDEX idx_report_cache_expires_at ON report_cache(expires_at);
CREATE INDEX idx_report_cache_stale ON report_cache(is_stale) WHERE is_stale = true;
CREATE INDEX idx_report_cache_created_at ON report_cache(created_at DESC);
```

### 4. Supporting Tables

#### view_shares Table
For managing shared custom views.

```sql
CREATE TABLE view_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    view_id UUID NOT NULL REFERENCES custom_views(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{"read": true, "write": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(view_id, shared_with)
);

-- Indexes
CREATE INDEX idx_view_shares_view_id ON view_shares(view_id);
CREATE INDEX idx_view_shares_shared_with ON view_shares(shared_with);
CREATE INDEX idx_view_shares_expires_at ON view_shares(expires_at) WHERE expires_at IS NOT NULL;
```

## Migrations

### Migration 1: Create Base Tables

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom_views table
CREATE TABLE custom_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    view_type VARCHAR(50) NOT NULL CHECK (view_type IN ('query', 'chart', 'table', 'dashboard')),
    configuration JSONB NOT NULL,
    filters JSONB,
    sort_config JSONB,
    is_public BOOLEAN DEFAULT false,
    is_template BOOLEAN DEFAULT false,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0
);

-- Create dashboard_layouts table
CREATE TABLE dashboard_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout_config JSONB NOT NULL,
    widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
    grid_settings JSONB,
    theme_config JSONB,
    is_default BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false,
    shared_with UUID[],
    permissions JSONB DEFAULT '{"read": true, "write": false, "admin": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_viewed_at TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0
);

-- Create report_cache table
CREATE TABLE report_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(512) NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    report_type VARCHAR(100) NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    parameters JSONB,
    result_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    row_count INTEGER,
    data_size_bytes INTEGER,
    execution_time_ms INTEGER,
    is_stale BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0
);

-- Create view_shares table
CREATE TABLE view_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    view_id UUID NOT NULL REFERENCES custom_views(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{"read": true, "write": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(view_id, shared_with)
);
```

### Migration 2: Create Indexes

```sql
-- custom_views indexes
CREATE INDEX idx_custom_views_user_id ON custom_views(user_id);
CREATE INDEX idx_custom_views_type ON custom_views(view_type);
CREATE INDEX idx_custom_views_public ON custom_views(is_public) WHERE is_public = true;
CREATE INDEX idx_custom_views_template ON custom_views(is_template) WHERE is_template = true;
CREATE INDEX idx_custom_views_tags ON custom_views USING GIN(tags);
CREATE INDEX idx_custom_views_config ON custom_views USING GIN(configuration);
CREATE INDEX idx_custom_views_updated_at ON custom_views(updated_at DESC);

-- dashboard_layouts indexes
CREATE INDEX idx_dashboard_layouts_user_id ON dashboard_layouts(user_id);
CREATE INDEX idx_dashboard_layouts_default ON dashboard_layouts(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_dashboard_layouts_shared ON dashboard_layouts(is_shared) WHERE is_shared = true;
CREATE INDEX idx_dashboard_layouts_widgets ON dashboard_layouts USING GIN(widgets);
CREATE INDEX idx_dashboard_layouts_shared_with ON dashboard_layouts USING GIN(shared_with);
CREATE INDEX idx_dashboard_layouts_updated_at ON dashboard_layouts(updated_at DESC);

-- report_cache indexes
CREATE UNIQUE INDEX idx_report_cache_key ON report_cache(cache_key);
CREATE INDEX idx_report_cache_user_id ON report_cache(user_id);
CREATE INDEX idx_report_cache_type ON report_cache(report_type);
CREATE INDEX idx_report_cache_hash ON report_cache(query_hash);
CREATE INDEX idx_report_cache_expires_at ON report_cache(expires_at);
CREATE INDEX idx_report_cache_stale ON report_cache(is_stale) WHERE is_stale = true;
CREATE INDEX idx_report_cache_created_at ON report_cache(created_at DESC);

-- view_shares indexes
CREATE INDEX idx_view_shares_view_id ON view_shares(view_id);
CREATE INDEX idx_view_shares_shared_with ON view_shares(shared_with);
CREATE INDEX idx_view_shares_expires_at ON view_shares(expires_at) WHERE expires_at IS NOT NULL;
```

### Migration 3: Create Triggers for Updated At

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_custom_views_updated_at
    BEFORE UPDATE ON custom_views
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_layouts_updated_at
    BEFORE UPDATE ON dashboard_layouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Migration 4: Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE custom_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_views
CREATE POLICY "Users can view their own custom views" ON custom_views
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view public custom views" ON custom_views
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view shared custom views" ON custom_views
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM view_shares 
            WHERE view_id = custom_views.id 
            AND shared_with = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own custom views" ON custom_views
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom views" ON custom_views
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom views" ON custom_views
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for dashboard_layouts
CREATE POLICY "Users can view their own dashboards" ON dashboard_layouts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared dashboards" ON dashboard_layouts
    FOR SELECT USING (
        is_shared = true AND (
            auth.uid() = ANY(shared_with) OR
            shared_with IS NULL
        )
    );

CREATE POLICY "Users can insert their own dashboards" ON dashboard_layouts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards" ON dashboard_layouts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards" ON dashboard_layouts
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for report_cache
CREATE POLICY "Users can view their own cached reports" ON report_cache
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own cached reports" ON report_cache
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own cached reports" ON report_cache
    FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their own cached reports" ON report_cache
    FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS Policies for view_shares
CREATE POLICY "Users can view shares where they are recipient" ON view_shares
    FOR SELECT USING (auth.uid() = shared_with);

CREATE POLICY "Users can view shares they created" ON view_shares
    FOR SELECT USING (auth.uid() = shared_by);

CREATE POLICY "Users can create shares for their views" ON view_shares
    FOR INSERT WITH CHECK (
        auth.uid() = shared_by AND
        EXISTS (
            SELECT 1 FROM custom_views 
            WHERE id = view_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own shares" ON view_shares
    FOR UPDATE USING (auth.uid() = shared_by);

CREATE POLICY "Users can delete their own shares" ON view_shares
    FOR DELETE USING (auth.uid() = shared_by);
```