# Brand Selection Dropdown - Technical Specification

## Architecture Overview

### System Components
```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   BigQuery      │────▶│ Sync Service │────▶│   Supabase      │
│   (Source)      │     │              │     │   (Storage)     │
└─────────────────┘     └──────────────┘     └─────────────────┘
                               │                      │
                               ▼                      ▼
                        ┌──────────────┐     ┌─────────────────┐
                        │Brand Extract │     │   Brand API     │
                        │   Service    │     │   Routes        │
                        └──────────────┘     └─────────────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │  React Client   │
                                            │  (Brand UI)     │
                                            └─────────────────┘
```

## Detailed Implementation

### 1. Database Layer

#### Schema Changes
```sql
-- 1. Brand hierarchy support
CREATE TABLE IF NOT EXISTS sqp.brand_hierarchy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_brand_id UUID NOT NULL REFERENCES sqp.brands(id) ON DELETE CASCADE,
  child_brand_id UUID NOT NULL REFERENCES sqp.brands(id) ON DELETE CASCADE,
  hierarchy_level INTEGER DEFAULT 1,
  relationship_type VARCHAR(50) DEFAULT 'sub_brand',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_brand_relationship UNIQUE(parent_brand_id, child_brand_id),
  CONSTRAINT no_self_reference CHECK (parent_brand_id != child_brand_id)
);

-- 2. Brand extraction rules
CREATE TABLE IF NOT EXISTS sqp.brand_extraction_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES sqp.brands(id) ON DELETE CASCADE,
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('pattern', 'prefix', 'suffix', 'exact', 'regex')),
  rule_value TEXT NOT NULL,
  case_sensitive BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 100,
  min_confidence NUMERIC(3,2) DEFAULT 0.80,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Brand metadata
ALTER TABLE sqp.brands 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_color VARCHAR(7),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS asin_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- 4. ASIN brand mapping improvements
ALTER TABLE sqp.asin_brand_mapping
ADD COLUMN IF NOT EXISTS extraction_rule_id UUID REFERENCES sqp.brand_extraction_rules(id),
ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}';

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_hierarchy_parent ON sqp.brand_hierarchy(parent_brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_hierarchy_child ON sqp.brand_hierarchy(child_brand_id);
CREATE INDEX IF NOT EXISTS idx_extraction_rules_active ON sqp.brand_extraction_rules(is_active, priority DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_asin_mapping_brand ON sqp.asin_brand_mapping(brand_id);
CREATE INDEX IF NOT EXISTS idx_brands_active ON sqp.brands(is_active, display_name) WHERE is_active = true;

-- 6. Create materialized view for brand performance
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.brand_performance_summary AS
SELECT 
  b.id as brand_id,
  b.display_name as brand_name,
  COUNT(DISTINCT abm.asin) as total_asins,
  COUNT(DISTINCT sqp.search_query) as unique_queries,
  SUM(sqp.asin_impression_count) as total_impressions,
  SUM(sqp.asin_click_count) as total_clicks,
  SUM(sqp.asin_purchase_count) as total_purchases,
  AVG(sqp.asin_click_count::NUMERIC / NULLIF(sqp.asin_impression_count, 0)) as avg_ctr,
  AVG(sqp.asin_purchase_count::NUMERIC / NULLIF(sqp.asin_click_count, 0)) as avg_cvr,
  MIN(apd.start_date) as earliest_date,
  MAX(apd.end_date) as latest_date
FROM sqp.brands b
JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
JOIN sqp.asin_performance_data apd ON abm.asin = apd.asin
JOIN sqp.search_query_performance sqp ON apd.id = sqp.asin_performance_id
WHERE b.is_active = true
GROUP BY b.id, b.display_name;

CREATE UNIQUE INDEX ON sqp.brand_performance_summary(brand_id);
```

#### Database Functions
```sql
-- Function to extract brand from product title
CREATE OR REPLACE FUNCTION sqp.extract_brand_from_title(
  p_product_title TEXT,
  p_asin VARCHAR(10)
) RETURNS TABLE (
  brand_id UUID,
  confidence_score NUMERIC,
  extraction_method VARCHAR,
  rule_id UUID
) AS $$
BEGIN
  -- Try exact match rules first
  RETURN QUERY
  SELECT 
    ber.brand_id,
    1.0::NUMERIC as confidence_score,
    'exact'::VARCHAR as extraction_method,
    ber.id as rule_id
  FROM sqp.brand_extraction_rules ber
  WHERE ber.is_active = true
    AND ber.rule_type = 'exact'
    AND (
      (NOT ber.case_sensitive AND LOWER(p_product_title) = LOWER(ber.rule_value)) OR
      (ber.case_sensitive AND p_product_title = ber.rule_value)
    )
  ORDER BY ber.priority DESC
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Try pattern match rules
  RETURN QUERY
  SELECT 
    ber.brand_id,
    CASE 
      WHEN position(ber.rule_value IN p_product_title) = 1 THEN 0.95
      WHEN position(ber.rule_value IN p_product_title) > 0 THEN 0.85
      ELSE 0.75
    END::NUMERIC as confidence_score,
    'pattern'::VARCHAR as extraction_method,
    ber.id as rule_id
  FROM sqp.brand_extraction_rules ber
  WHERE ber.is_active = true
    AND ber.rule_type = 'pattern'
    AND (
      (NOT ber.case_sensitive AND position(LOWER(ber.rule_value) IN LOWER(p_product_title)) > 0) OR
      (ber.case_sensitive AND position(ber.rule_value IN p_product_title) > 0)
    )
  ORDER BY ber.priority DESC, LENGTH(ber.rule_value) DESC
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Try regex rules
  RETURN QUERY
  SELECT 
    ber.brand_id,
    0.80::NUMERIC as confidence_score,
    'regex'::VARCHAR as extraction_method,
    ber.id as rule_id
  FROM sqp.brand_extraction_rules ber
  WHERE ber.is_active = true
    AND ber.rule_type = 'regex'
    AND (
      (NOT ber.case_sensitive AND p_product_title ~* ber.rule_value) OR
      (ber.case_sensitive AND p_product_title ~ ber.rule_value)
    )
  ORDER BY ber.priority DESC
  LIMIT 1;

  -- No match found
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, 'none'::VARCHAR, NULL::UUID;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update brand ASIN counts
CREATE OR REPLACE FUNCTION sqp.update_brand_asin_counts() RETURNS void AS $$
BEGIN
  UPDATE sqp.brands b
  SET asin_count = (
    SELECT COUNT(DISTINCT asin)
    FROM sqp.asin_brand_mapping abm
    WHERE abm.brand_id = b.id
  );
END;
$$ LANGUAGE plpgsql;
```

### 2. API Layer

#### Brand Service
```typescript
// src/services/brand/brand-service.ts
import { createClient } from '@/lib/supabase/server'

export class BrandService {
  private supabase = createClient()

  async getAllBrands(options?: {
    includeInactive?: boolean
    includeHierarchy?: boolean
    includeCounts?: boolean
  }) {
    let query = this.supabase
      .from('brands')
      .select(`
        id,
        brand_name,
        normalized_name,
        display_name,
        logo_url,
        brand_color,
        description,
        is_active,
        parent_brand_id,
        metadata,
        ${options?.includeCounts ? 'asin_count' : ''}
      `)

    if (!options?.includeInactive) {
      query = query.eq('is_active', true)
    }

    query = query.order('display_name')

    const { data: brands, error } = await query

    if (error) throw error

    if (options?.includeHierarchy) {
      // Build hierarchy tree
      return this.buildBrandHierarchy(brands)
    }

    return brands
  }

  async extractBrandsFromSync(syncData: any[]) {
    const extractionResults = []
    
    for (const item of syncData) {
      if (!item.product_title || !item.asin) continue

      // Call extraction function
      const { data: extraction, error } = await this.supabase
        .rpc('extract_brand_from_title', {
          p_product_title: item.product_title,
          p_asin: item.asin
        })

      if (!error && extraction && extraction[0]?.brand_id) {
        extractionResults.push({
          asin: item.asin,
          brand_id: extraction[0].brand_id,
          confidence_score: extraction[0].confidence_score,
          extraction_method: extraction[0].extraction_method,
          rule_id: extraction[0].rule_id
        })
      } else {
        // No brand found - flag for manual review
        extractionResults.push({
          asin: item.asin,
          brand_id: null,
          confidence_score: 0,
          extraction_method: 'manual_required',
          rule_id: null
        })
      }
    }

    // Batch upsert mappings
    await this.upsertBrandMappings(extractionResults)
    
    // Update brand counts
    await this.supabase.rpc('update_brand_asin_counts')

    return extractionResults
  }

  private async upsertBrandMappings(mappings: any[]) {
    // Filter out mappings without brand_id
    const validMappings = mappings.filter(m => m.brand_id)

    if (validMappings.length === 0) return

    const { error } = await this.supabase
      .from('asin_brand_mapping')
      .upsert(
        validMappings.map(m => ({
          asin: m.asin,
          brand_id: m.brand_id,
          confidence_score: m.confidence_score,
          extraction_method: m.extraction_method,
          extraction_rule_id: m.rule_id,
          extraction_metadata: {
            extracted_at: new Date().toISOString(),
            sync_source: 'bigquery'
          }
        })),
        { 
          onConflict: 'asin',
          ignoreDuplicates: false 
        }
      )

    if (error) throw error
  }

  private buildBrandHierarchy(brands: any[]) {
    const brandMap = new Map(brands.map(b => [b.id, b]))
    const rootBrands = []

    for (const brand of brands) {
      if (!brand.parent_brand_id) {
        rootBrands.push({
          ...brand,
          children: []
        })
      }
    }

    // Build tree structure
    for (const brand of brands) {
      if (brand.parent_brand_id) {
        const parent = brandMap.get(brand.parent_brand_id)
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(brand)
        }
      }
    }

    return rootBrands
  }
}
```

#### Updated API Routes
```typescript
// src/app/api/brands/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { BrandService } from '@/services/brand/brand-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const includeHierarchy = searchParams.get('includeHierarchy') === 'true'
    const includeCounts = searchParams.get('includeCounts') === 'true'

    const brandService = new BrandService()
    const brands = await brandService.getAllBrands({
      includeInactive,
      includeHierarchy,
      includeCounts
    })

    return NextResponse.json({
      data: brands,
      total: brands.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching brands:', error)
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    )
  }
}

// src/app/api/brands/sync/route.ts
export async function POST(request: NextRequest) {
  try {
    const { asins } = await request.json()
    
    if (!Array.isArray(asins)) {
      return NextResponse.json(
        { error: 'Invalid input: asins must be an array' },
        { status: 400 }
      )
    }

    const brandService = new BrandService()
    const results = await brandService.extractBrandsFromSync(asins)

    const summary = {
      total: results.length,
      mapped: results.filter(r => r.brand_id).length,
      unmapped: results.filter(r => !r.brand_id).length,
      byMethod: results.reduce((acc, r) => {
        acc[r.extraction_method] = (acc[r.extraction_method] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }

    return NextResponse.json({
      summary,
      results: results.slice(0, 100), // Limit response size
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error syncing brands:', error)
    return NextResponse.json(
      { error: 'Failed to sync brands' },
      { status: 500 }
    )
  }
}
```

### 3. Frontend Implementation

#### Enhanced Brand Selector Component
```tsx
// src/components/brand/BrandSelector.tsx
import React, { useState, useRef, useEffect } from 'react'
import { ChevronDownIcon, BuildingIcon, SearchIcon } from 'lucide-react'
import { useBrands } from '@/hooks/useBrands'
import { cn } from '@/lib/utils'

interface Brand {
  id: string
  display_name: string
  logo_url?: string
  brand_color?: string
  asin_count?: number
  children?: Brand[]
}

interface BrandSelectorProps {
  value: string
  onChange: (brandId: string) => void
  showCounts?: boolean
  showHierarchy?: boolean
  placeholder?: string
  className?: string
}

export function BrandSelector({
  value,
  onChange,
  showCounts = true,
  showHierarchy = false,
  placeholder = 'Select a brand',
  className
}: BrandSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { data: brandsData, isLoading } = useBrands({
    includeHierarchy: showHierarchy,
    includeCounts: showCounts
  })

  const brands = brandsData?.data || []
  const selectedBrand = findBrandById(brands, value)

  // Filter brands based on search
  const filteredBrands = searchQuery
    ? filterBrands(brands, searchQuery)
    : brands

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (brandId: string) => {
    onChange(brandId)
    setIsOpen(false)
    setSearchQuery('')
  }

  const renderBrand = (brand: Brand, level = 0) => {
    const isSelected = brand.id === value

    return (
      <React.Fragment key={brand.id}>
        <div
          className={cn(
            'flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer transition-colors',
            isSelected && 'bg-blue-50 text-blue-600',
            level > 0 && 'pl-' + (3 + level * 4)
          )}
          onClick={() => handleSelect(brand.id)}
        >
          <div className="flex items-center flex-1 min-w-0">
            {brand.logo_url ? (
              <img
                src={brand.logo_url}
                alt={brand.display_name}
                className="w-5 h-5 mr-2 object-contain"
              />
            ) : (
              <div
                className="w-5 h-5 mr-2 rounded flex items-center justify-center"
                style={{ backgroundColor: brand.brand_color || '#e5e7eb' }}
              >
                <BuildingIcon size={12} className="text-white" />
              </div>
            )}
            <span className="truncate">{brand.display_name}</span>
          </div>
          {showCounts && brand.asin_count !== undefined && (
            <span className="text-xs text-gray-500 ml-2">
              {brand.asin_count} ASINs
            </span>
          )}
        </div>
        {showHierarchy && brand.children?.map(child => 
          renderBrand(child, level + 1)
        )}
      </React.Fragment>
    )
  }

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 bg-white border rounded-md shadow-sm',
          'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
          isOpen && 'ring-2 ring-blue-500'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center min-w-0">
          {selectedBrand ? (
            <>
              {selectedBrand.logo_url ? (
                <img
                  src={selectedBrand.logo_url}
                  alt={selectedBrand.display_name}
                  className="w-5 h-5 mr-2 object-contain"
                />
              ) : (
                <div
                  className="w-5 h-5 mr-2 rounded flex items-center justify-center"
                  style={{ backgroundColor: selectedBrand.brand_color || '#e5e7eb' }}
                >
                  <BuildingIcon size={12} className="text-white" />
                </div>
              )}
              <span className="truncate">{selectedBrand.display_name}</span>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <ChevronDownIcon
          size={16}
          className={cn(
            'ml-2 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-96 overflow-hidden">
          <div className="sticky top-0 bg-white border-b p-2">
            <div className="relative">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search brands..."
                className="w-full pl-9 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-80">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                Loading brands...
              </div>
            ) : filteredBrands.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No brands found
              </div>
            ) : (
              filteredBrands.map(brand => renderBrand(brand))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper functions
function findBrandById(brands: Brand[], id: string): Brand | null {
  for (const brand of brands) {
    if (brand.id === id) return brand
    if (brand.children) {
      const found = findBrandById(brand.children, id)
      if (found) return found
    }
  }
  return null
}

function filterBrands(brands: Brand[], query: string): Brand[] {
  const lowerQuery = query.toLowerCase()
  const filtered: Brand[] = []

  for (const brand of brands) {
    if (brand.display_name.toLowerCase().includes(lowerQuery)) {
      filtered.push(brand)
    } else if (brand.children) {
      const filteredChildren = filterBrands(brand.children, query)
      if (filteredChildren.length > 0) {
        filtered.push({
          ...brand,
          children: filteredChildren
        })
      }
    }
  }

  return filtered
}
```

#### Brand Context
```typescript
// src/contexts/BrandContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface BrandContextValue {
  selectedBrandId: string | null
  setSelectedBrandId: (brandId: string | null) => void
  isLoading: boolean
}

const BrandContext = createContext<BrandContextValue | undefined>(undefined)

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Load selected brand from localStorage on mount
  useEffect(() => {
    const savedBrandId = localStorage.getItem('selectedBrandId')
    if (savedBrandId) {
      setSelectedBrandId(savedBrandId)
    }
    setIsLoading(false)
  }, [])

  // Save selected brand to localStorage
  const handleSetSelectedBrandId = (brandId: string | null) => {
    setSelectedBrandId(brandId)
    if (brandId) {
      localStorage.setItem('selectedBrandId', brandId)
    } else {
      localStorage.removeItem('selectedBrandId')
    }

    // If on brand page, navigate to new brand
    if (pathname.startsWith('/brands/') && brandId) {
      router.push(`/brands/${brandId}`)
    }
  }

  return (
    <BrandContext.Provider
      value={{
        selectedBrandId,
        setSelectedBrandId: handleSetSelectedBrandId,
        isLoading
      }}
    >
      {children}
    </BrandContext.Provider>
  )
}

export function useBrandContext() {
  const context = useContext(BrandContext)
  if (!context) {
    throw new Error('useBrandContext must be used within BrandProvider')
  }
  return context
}
```

### 4. Integration Points

#### BigQuery Sync Integration
```typescript
// src/scripts/sync-with-brand-extraction.ts
import { BrandService } from '@/services/brand/brand-service'

export async function syncBigQueryDataWithBrands() {
  console.log('Starting BigQuery sync with brand extraction...')
  
  try {
    // 1. Fetch data from BigQuery
    const bigQueryData = await fetchFromBigQuery()
    
    // 2. Sync performance data
    await syncPerformanceData(bigQueryData)
    
    // 3. Extract and map brands
    const brandService = new BrandService()
    const brandResults = await brandService.extractBrandsFromSync(
      bigQueryData.map(item => ({
        asin: item.asin,
        product_title: item.product_title
      }))
    )
    
    console.log('Brand extraction results:', {
      total: brandResults.length,
      mapped: brandResults.filter(r => r.brand_id).length,
      unmapped: brandResults.filter(r => !r.brand_id).length
    })
    
    // 4. Log unmapped ASINs for manual review
    const unmappedAsins = brandResults
      .filter(r => !r.brand_id)
      .map(r => r.asin)
    
    if (unmappedAsins.length > 0) {
      console.warn(`${unmappedAsins.length} ASINs require manual brand mapping:`, 
        unmappedAsins.slice(0, 10)
      )
    }
    
    return {
      success: true,
      syncedRecords: bigQueryData.length,
      brandMapping: {
        mapped: brandResults.filter(r => r.brand_id).length,
        unmapped: unmappedAsins.length
      }
    }
  } catch (error) {
    console.error('Sync failed:', error)
    throw error
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
// src/services/brand/__tests__/brand-service.test.ts
describe('BrandService', () => {
  describe('extractBrandsFromSync', () => {
    it('should extract brands using exact match rules', async () => {
      // Test implementation
    })
    
    it('should extract brands using pattern rules', async () => {
      // Test implementation
    })
    
    it('should handle ASINs with no matching brand', async () => {
      // Test implementation
    })
  })
})
```

### Integration Tests
```typescript
// src/app/api/brands/__tests__/integration.test.ts
describe('Brand API Integration', () => {
  it('should return brands with proper structure', async () => {
    // Test implementation
  })
  
  it('should filter by active status', async () => {
    // Test implementation
  })
  
  it('should include hierarchy when requested', async () => {
    // Test implementation
  })
})
```

## Performance Considerations

1. **Caching**: Implement Redis caching for brand lists (5-minute TTL)
2. **Indexing**: Ensure all foreign keys and frequently queried fields are indexed
3. **Pagination**: Limit brand mapping results to prevent large payloads
4. **Batch Processing**: Process brand extraction in batches of 1000 ASINs
5. **Materialized Views**: Use for brand performance summaries

## Security Considerations

1. **Input Validation**: Sanitize all brand names and rules
2. **SQL Injection**: Use parameterized queries
3. **Rate Limiting**: Implement rate limiting on brand sync endpoints
4. **Audit Trail**: Log all brand modifications
5. **Access Control**: Implement role-based access for brand management

## Monitoring & Observability

1. **Metrics to Track**:
   - Brand extraction accuracy
   - Unmapped ASIN count
   - API response times
   - Cache hit rates

2. **Alerts**:
   - High percentage of unmapped ASINs (>5%)
   - Brand sync failures
   - API errors

3. **Logging**:
   - Brand extraction decisions
   - API requests
   - Cache operations