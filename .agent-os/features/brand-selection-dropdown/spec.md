# Brand Selection Dropdown Feature Specification

## Overview
Implement a future-proof brand selection dropdown system that dynamically populates from BigQuery data, manages ASIN-brand associations, and filters dashboard data based on the selected brand.

## Current State Analysis

### Database Schema
- **sqp.brands** table exists with:
  - `id` (UUID): Unique identifier
  - `brand_name`: Official brand name
  - `normalized_name`: Lowercase for matching
  - `display_name`: UI display name
  - `parent_brand_id`: For brand hierarchies (currently unused)
  - `is_active`: Active/inactive status
  
- **sqp.asin_brand_mapping** table exists with:
  - `asin`: Product ASIN
  - `brand_id`: Reference to brands table
  - `product_title`: Full product title
  - `extraction_method`: How brand was identified
  - `confidence_score`: Extraction confidence
  - `verified`: Manual verification flag

- **No brand_hierarchy** table exists (mentioned but not implemented)

### Current Implementation
- Brand dropdown is functional in Header component
- Currently has 2 brands: "Work Sharp" and "Product" (test data)
- 84 ASINs mapped across these brands
- Brand selection persists via localStorage
- API endpoint at `/api/brands` returns active brands

### Issues to Address
1. API response format inconsistency (returns array directly vs. `{ data: [...] }`)
2. No automatic brand detection for new BigQuery data
3. Missing brand hierarchy support
4. No bulk brand management interface

## Requirements

### Functional Requirements

#### 1. Dynamic Brand Population
- Automatically detect and create new brands from BigQuery sync
- Extract brand information from product titles during sync
- Support multiple brand extraction methods:
  - Pattern matching (e.g., "Work Sharp" in title)
  - ASIN prefix patterns
  - Manual override mappings

#### 2. Brand Selection Dropdown
- Display all active brands in alphabetical order
- Show brand display name with optional icon/logo
- Remember last selected brand per user
- Default to first available brand if none selected
- Support keyboard navigation

#### 3. Data Filtering
- Filter all dashboard data by selected brand
- Apply brand filter to:
  - ASIN performance data
  - Search query performance
  - KPI calculations
  - Market share analysis

#### 4. Brand Management
- Admin interface for brand configuration
- Ability to:
  - Edit brand display names
  - Set brand hierarchies
  - Verify/correct ASIN mappings
  - Activate/deactivate brands

### Non-Functional Requirements

#### 1. Performance
- Brand list cached for 5 minutes
- Efficient filtering queries using indexes
- Support for 100+ brands without UI degradation

#### 2. Scalability
- Handle thousands of ASINs per brand
- Support nested brand hierarchies
- Batch processing for bulk updates

#### 3. Data Integrity
- Prevent orphaned ASINs (unmapped to any brand)
- Maintain audit trail for brand changes
- Validate brand extraction confidence

## Technical Implementation

### Database Schema Updates

#### 1. Create Brand Hierarchy Support
```sql
CREATE TABLE sqp.brand_hierarchy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_brand_id UUID REFERENCES sqp.brands(id),
  child_brand_id UUID REFERENCES sqp.brands(id),
  hierarchy_level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_brand_id, child_brand_id)
);

-- Index for efficient hierarchy queries
CREATE INDEX idx_brand_hierarchy_parent ON sqp.brand_hierarchy(parent_brand_id);
CREATE INDEX idx_brand_hierarchy_child ON sqp.brand_hierarchy(child_brand_id);
```

#### 2. Add Brand Extraction Rules
```sql
CREATE TABLE sqp.brand_extraction_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES sqp.brands(id),
  rule_type VARCHAR(50) CHECK (rule_type IN ('pattern', 'prefix', 'exact')),
  rule_value TEXT NOT NULL,
  priority INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for rule matching
CREATE INDEX idx_extraction_rules_active ON sqp.brand_extraction_rules(is_active, priority DESC);
```

#### 3. Add Brand Assets
```sql
ALTER TABLE sqp.brands ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE sqp.brands ADD COLUMN IF NOT EXISTS brand_color VARCHAR(7);
ALTER TABLE sqp.brands ADD COLUMN IF NOT EXISTS description TEXT;
```

### API Updates

#### 1. Fix Brand List API Response
```typescript
// /api/brands/route.ts
export async function GET() {
  const { data: brands, error } = await supabase
    .from('brands')
    .select(`
      id,
      display_name,
      logo_url,
      brand_color,
      asin_count:asin_brand_mapping(count)
    `)
    .eq('is_active', true)
    .order('display_name');

  return NextResponse.json({
    data: brands || [],
    total: brands?.length || 0
  });
}
```

#### 2. Add Brand Sync Function
```typescript
// /api/sync/extract-brands/route.ts
export async function POST(request: Request) {
  const { asins } = await request.json();
  
  // Process ASINs and extract brands
  const extractedBrands = await extractBrandsFromASINs(asins);
  
  // Create new brands if needed
  const newBrands = await createNewBrands(extractedBrands);
  
  // Update ASIN mappings
  const mappings = await updateASINMappings(asins, extractedBrands);
  
  return NextResponse.json({
    newBrands,
    updatedMappings: mappings.length
  });
}
```

### Component Updates

#### 1. Enhanced Brand Selector
```typescript
interface BrandSelectorProps {
  value: string;
  onChange: (brandId: string) => void;
  showCounts?: boolean;
  allowMultiple?: boolean;
}

export function BrandSelector({
  value,
  onChange,
  showCounts = true,
  allowMultiple = false
}: BrandSelectorProps) {
  // Implementation with:
  // - Search/filter capability
  // - Brand icons/colors
  // - ASIN counts
  // - Hierarchy display
  // - Loading states
}
```

#### 2. Brand Context Provider
```typescript
export function BrandProvider({ children }: { children: ReactNode }) {
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [brandHierarchy, setBrandHierarchy] = useState<BrandHierarchy[]>([]);
  
  // Provide brand context to entire app
  // Handle brand switching
  // Manage brand-related state
}
```

### Data Flow Updates

#### 1. BigQuery Sync Integration
```typescript
// In sync process
async function syncBigQueryData() {
  // 1. Fetch data from BigQuery
  const data = await fetchBigQueryData();
  
  // 2. Extract unique brands
  const brands = await extractBrandsFromData(data);
  
  // 3. Create/update brands in database
  await upsertBrands(brands);
  
  // 4. Map ASINs to brands
  await mapASINsToBrands(data);
  
  // 5. Sync performance data
  await syncPerformanceData(data);
}
```

#### 2. Brand-Filtered Queries
```sql
-- Example: Get performance data for selected brand
SELECT 
  apd.*,
  abm.brand_id,
  b.display_name as brand_name
FROM sqp.asin_performance_data apd
JOIN sqp.asin_brand_mapping abm ON apd.asin = abm.asin
JOIN sqp.brands b ON abm.brand_id = b.id
WHERE b.id = $1 -- Selected brand ID
  AND apd.start_date >= $2
  AND apd.end_date <= $3;
```

## Implementation Phases

### Phase 1: Fix Current Implementation (Week 1)
1. Fix API response format inconsistency
2. Add proper TypeScript types
3. Ensure brand persistence works correctly
4. Add loading and error states

### Phase 2: Database Schema Updates (Week 1)
1. Create brand hierarchy table
2. Add extraction rules table
3. Update brands table with additional fields
4. Create necessary indexes

### Phase 3: Brand Extraction System (Week 2)
1. Implement brand extraction logic
2. Create extraction rules interface
3. Add confidence scoring
4. Build verification workflow

### Phase 4: Enhanced UI Components (Week 2)
1. Build advanced brand selector
2. Create brand management interface
3. Add brand analytics dashboard
4. Implement keyboard navigation

### Phase 5: Integration & Testing (Week 3)
1. Integrate with BigQuery sync
2. Update all queries for brand filtering
3. Performance testing with multiple brands
4. User acceptance testing

## Success Criteria

1. **Automatic Brand Detection**: 95%+ accuracy in brand extraction
2. **Performance**: Brand dropdown loads in <100ms
3. **Scalability**: Support 100+ brands without degradation
4. **Data Accuracy**: All ASINs correctly mapped to brands
5. **User Experience**: Seamless brand switching with data persistence

## Migration Strategy

1. **Data Migration**:
   - Audit existing ASIN-brand mappings
   - Create extraction rules based on current patterns
   - Run extraction on historical data
   - Verify and correct mappings

2. **Code Migration**:
   - Update API endpoints with backward compatibility
   - Migrate components incrementally
   - Maintain feature flags for rollback

3. **User Migration**:
   - Notify users of enhanced features
   - Provide training on brand management
   - Gather feedback for improvements

## Risk Mitigation

1. **Data Quality**: Implement validation and manual review process
2. **Performance**: Use caching and optimize queries
3. **Compatibility**: Maintain backward compatibility during transition
4. **User Adoption**: Provide clear documentation and training

## Future Enhancements

1. **Multi-brand Comparison**: Compare performance across brands
2. **Brand Portfolio Management**: Group brands into portfolios
3. **Automated Alerts**: Notify on new brand detection
4. **Brand Performance Insights**: AI-driven brand analysis
5. **White-label Support**: Customize UI per brand

## Conclusion

This specification provides a comprehensive plan for implementing a robust, scalable brand selection system that will automatically adapt to new brands in the BigQuery database while maintaining excellent performance and user experience.