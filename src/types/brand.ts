/**
 * Brand-related TypeScript types and interfaces
 * @module types/brand
 */

/**
 * Core brand entity representing a product brand in the system
 * @interface Brand
 */
export interface Brand {
  id: string
  brand_name: string
  normalized_name: string
  display_name: string
  parent_brand_id?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Extended fields
  logo_url?: string
  brand_color?: string
  description?: string
  asin_count?: number
  last_sync_at?: string
  metadata?: Record<string, any>
}

/**
 * Brand with hierarchy information
 */
export interface BrandWithHierarchy extends Brand {
  children?: BrandWithHierarchy[]
  parent?: Brand
  hierarchy_level?: number
}

/**
 * ASIN to brand mapping
 */
export interface ASINBrandMapping {
  asin: string
  brand_id: string
  product_title: string
  extraction_method: 'automatic' | 'manual' | 'override'
  confidence_score?: number
  verified: boolean
  created_at: string
  updated_at: string
  extraction_rule_id?: string
  extraction_metadata?: {
    extracted_at: string
    sync_source: string
    [key: string]: any
  }
}

/**
 * Brand extraction rule
 */
export interface BrandExtractionRule {
  id: string
  brand_id: string
  rule_type: 'pattern' | 'prefix' | 'suffix' | 'exact' | 'regex'
  rule_value: string
  case_sensitive?: boolean
  priority?: number
  min_confidence?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Brand hierarchy relationship
 */
export interface BrandHierarchy {
  id: string
  parent_brand_id: string
  child_brand_id: string
  hierarchy_level: number
  relationship_type?: string
  created_at: string
  updated_at: string
}

/**
 * Brand performance metrics
 */
export interface BrandPerformanceMetrics {
  brand_id: string
  brand_name: string
  total_asins: number
  unique_queries: number
  total_impressions: number
  total_clicks: number
  total_purchases: number
  avg_ctr: number
  avg_cvr: number
  earliest_date: string
  latest_date: string
}

/**
 * API response types
 */
export interface BrandsResponse {
  data: Brand[]
  total: number
  timestamp: string
}

export interface BrandDetailsResponse {
  data: BrandWithHierarchy
  metrics?: BrandPerformanceMetrics
  timestamp: string
}

export interface BrandMappingsResponse {
  data: ASINBrandMapping[]
  total: number
  unmapped_count?: number
  timestamp: string
}

/**
 * Brand sync result
 */
export interface BrandSyncResult {
  asin: string
  brand_id: string | null
  confidence_score: number
  extraction_method: string
  rule_id: string | null
}

export interface BrandSyncSummary {
  total: number
  mapped: number
  unmapped: number
  byMethod: Record<string, number>
}

/**
 * Brand selector props
 */
export interface BrandSelectorProps {
  value: string
  onChange: (brandId: string) => void
  showCounts?: boolean
  showHierarchy?: boolean
  allowMultiple?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
  error?: string
}

/**
 * Brand context value
 */
export interface BrandContextValue {
  selectedBrandId: string | null
  setSelectedBrandId: (brandId: string | null) => void
  brands: Brand[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Type guards
 */
export function isBrand(obj: any): obj is Brand {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.brand_name === 'string' &&
    typeof obj.display_name === 'string' &&
    typeof obj.is_active === 'boolean'
  )
}

export function isBrandWithHierarchy(obj: any): obj is BrandWithHierarchy {
  return isBrand(obj) && ('children' in obj ? Array.isArray(obj.children) : true)
}

/**
 * Utility types
 */
export type BrandId = Brand['id']
export type BrandName = Brand['display_name']
export type ExtractionMethod = ASINBrandMapping['extraction_method']
export type RuleType = BrandExtractionRule['rule_type']