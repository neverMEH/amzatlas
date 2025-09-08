# Brand Selection Dropdown - Implementation Tasks

## Phase 1: Fix Current Implementation (2 days) ✅ COMPLETED (Sep 8, 2025)

### Task 1.1: Fix API Response Format ✅
**Priority**: High  
**Effort**: 2 hours  
**Status**: Completed  
**Description**: Update the brands API to return consistent response format
- [x] Update `/api/brands/route.ts` to return `{ data: [], total: number }` format
- [x] Update `Header.tsx` component to handle new response format
- [x] Update `useBrands` hook in `/lib/api/brands.ts`
- [x] Test backward compatibility

### Task 1.2: Add TypeScript Types ✅
**Priority**: High  
**Effort**: 1 hour  
**Status**: Completed  
**Description**: Create comprehensive TypeScript types for brand entities
- [x] Create `types/brand.ts` with interfaces for Brand, BrandHierarchy, BrandMapping
- [x] Update all brand-related components to use new types
- [x] Add JSDoc comments for better IDE support

### Task 1.3: Improve Error Handling ✅
**Priority**: Medium  
**Effort**: 2 hours  
**Status**: Completed  
**Description**: Add proper error handling and loading states
- [x] Add error boundaries for brand components
- [x] Implement retry logic for API failures
- [x] Add skeleton loaders for brand dropdown
- [x] Create user-friendly error messages

### Task 1.4: Fix Brand Persistence ✅
**Priority**: High  
**Effort**: 1 hour  
**Status**: Completed  
**Description**: Ensure brand selection persists correctly
- [x] Debug localStorage issues
- [x] Add session storage fallback
- [x] Implement brand selection sync across tabs
- [x] Add tests for persistence logic

### Task 1.5: Fix TypeScript Type Guards ✅
**Priority**: High  
**Effort**: 30 minutes  
**Status**: Completed (Sep 8, 2025)  
**Description**: Fix type guard for BrandWithHierarchy
- [x] Fixed `isBrandWithHierarchy` function to properly check for children property
- [x] Used `in` operator to safely check optional property existence
- [x] Resolved TypeScript build error preventing deployment

## Phase 2: Database Schema Updates (3 days) ✅ COMPLETED (Sep 8, 2025)

### Task 2.1: Create Migration Files ✅
**Priority**: High  
**Effort**: 4 hours  
**Status**: Completed (Sep 8, 2025)
**Description**: Create SQL migrations for new schema
- [x] Create migration for brand_hierarchy table (049)
- [x] Create migration for brand_extraction_rules table (049)
- [x] Create migration to update brands table with new columns (049)
- [x] Create migration to update asin_brand_mapping table (049)
- [x] Create indexes for performance (all migrations)

### Task 2.2: Implement Database Functions ✅
**Priority**: High  
**Effort**: 4 hours  
**Status**: Completed (Sep 8, 2025)
**Description**: Create PostgreSQL functions for brand operations
- [x] Implement `extract_brand_from_title` function (050)
- [x] Implement `update_brand_asin_counts` function (050)
- [x] Create function for brand hierarchy queries (050)
- [x] Add functions for brand performance metrics (050)
- [x] Added bulk extraction and application functions (050)

### Task 2.3: Create Materialized Views ✅
**Priority**: Medium  
**Effort**: 3 hours  
**Status**: Completed (Sep 8, 2025)
**Description**: Create views for optimized querying
- [x] Create brand_performance_summary materialized view (051)
- [x] Create brand_hierarchy_view for tree structure (051)
- [x] Create brand_extraction_analytics view (051)
- [x] Add refresh function and appropriate indexes (051)

### Task 2.4: Seed Initial Data ✅
**Priority**: Low  
**Effort**: 2 hours  
**Status**: Completed (Sep 8, 2025)
**Description**: Add initial brand extraction rules
- [x] Create extraction rules for Work Sharp brand (8 rules) (052)
- [x] Add common brand patterns (auto-generation) (052)
- [x] Apply extractions to unmapped ASINs (052)
- [x] Create monitoring view for rule effectiveness (052)

### Migration Issues Fixed During Phase 2:
1. **Schema Issues (049a)**: Moved brands tables from sqp to public schema
2. **Missing Extension (049b)**: Added pg_trgm extension for pattern matching
3. **Column Names (050a, 050b)**: Fixed column references to match actual schema:
   - `total_query_impression_count` (not `query_impressions`)
   - `asin_click_count`, `asin_cart_add_count`, `asin_purchase_count`
4. **Nested Aggregates (051a, 051b)**: Split views to avoid nested COUNT(DISTINCT) in jsonb_object_agg
5. **Missing Table (052a)**: Removed migration_log dependency

**Final Migration Order**: 049a → 049b → 049 → 050a → 051a → 051b → 052a

## Phase 3: Brand Extraction System (5 days)

### Task 3.1: Create Brand Service
**Priority**: High  
**Effort**: 6 hours  
**Description**: Implement core brand service logic
- [ ] Create `BrandService` class with extraction methods
- [ ] Implement brand hierarchy building logic
- [ ] Add batch processing for ASIN mappings
- [ ] Implement caching layer

### Task 3.2: Build Extraction Engine
**Priority**: High  
**Effort**: 8 hours  
**Description**: Create robust brand extraction system
- [ ] Implement pattern matching algorithms
- [ ] Add regex support for complex patterns
- [ ] Create confidence scoring system
- [ ] Add fallback strategies for unmapped ASINs

### Task 3.3: Create Admin Interface
**Priority**: Medium  
**Effort**: 8 hours  
**Description**: Build interface for brand management
- [ ] Create brand list page with CRUD operations
- [ ] Build extraction rules editor
- [ ] Add ASIN mapping review interface
- [ ] Implement bulk operations UI

### Task 3.4: Integrate with BigQuery Sync
**Priority**: High  
**Effort**: 6 hours  
**Description**: Add brand extraction to sync process
- [ ] Modify sync scripts to include brand extraction
- [ ] Add brand mapping step to data pipeline
- [ ] Implement error handling and logging
- [ ] Create monitoring for extraction accuracy

## Phase 4: Enhanced UI Components (4 days)

### Task 4.1: Build Advanced Brand Selector
**Priority**: High  
**Effort**: 8 hours  
**Description**: Create feature-rich brand selector component
- [ ] Implement search functionality
- [ ] Add brand logos and colors support
- [ ] Show ASIN counts per brand
- [ ] Support keyboard navigation
- [ ] Add loading and empty states

### Task 4.2: Update Header Component
**Priority**: High  
**Effort**: 4 hours  
**Description**: Integrate new brand selector in header
- [ ] Replace existing dropdown with new component
- [ ] Add brand quick switch functionality
- [ ] Implement brand favorites/recent brands
- [ ] Update responsive design

### Task 4.3: Create Brand Context Provider
**Priority**: High  
**Effort**: 4 hours  
**Description**: Implement global brand state management
- [ ] Create BrandContext with selected brand state
- [ ] Add brand switching logic
- [ ] Implement brand-based data filtering
- [ ] Add performance optimizations

### Task 4.4: Build Brand Analytics Dashboard
**Priority**: Low  
**Effort**: 6 hours  
**Description**: Create brand-specific analytics views
- [ ] Design brand overview page
- [ ] Add brand performance metrics
- [ ] Create brand comparison tools
- [ ] Implement export functionality

## Phase 5: Integration & Testing (3 days)

### Task 5.1: API Integration Testing
**Priority**: High  
**Effort**: 4 hours  
**Description**: Comprehensive API testing
- [ ] Write unit tests for brand service
- [ ] Create integration tests for API endpoints
- [ ] Test brand extraction accuracy
- [ ] Performance test with large datasets

### Task 5.2: Frontend Testing
**Priority**: High  
**Effort**: 4 hours  
**Description**: Test all UI components
- [ ] Write component tests for brand selector
- [ ] Test brand context provider
- [ ] Add E2E tests for brand switching
- [ ] Test accessibility compliance

### Task 5.3: Performance Optimization
**Priority**: Medium  
**Effort**: 6 hours  
**Description**: Optimize for scale
- [ ] Implement query optimization
- [ ] Add database query caching
- [ ] Optimize frontend bundle size
- [ ] Load test with 100+ brands

### Task 5.4: Documentation
**Priority**: Medium  
**Effort**: 4 hours  
**Description**: Create comprehensive documentation
- [ ] Write API documentation
- [ ] Create brand management guide
- [ ] Document extraction rules syntax
- [ ] Add troubleshooting guide

## Deployment & Migration (2 days)

### Task 6.1: Prepare Production Migration
**Priority**: High  
**Effort**: 4 hours  
**Description**: Ready system for production
- [ ] Create migration rollback plan
- [ ] Prepare data migration scripts
- [ ] Set up feature flags
- [ ] Create deployment checklist

### Task 6.2: Execute Migration
**Priority**: High  
**Effort**: 4 hours  
**Description**: Deploy to production
- [ ] Run database migrations
- [ ] Deploy API changes
- [ ] Deploy frontend changes
- [ ] Monitor for issues

### Task 6.3: Post-Deployment Validation
**Priority**: High  
**Effort**: 4 hours  
**Description**: Verify successful deployment
- [ ] Validate data integrity
- [ ] Check performance metrics
- [ ] Test all critical paths
- [ ] Monitor error logs

## Total Effort: ~19 days

## Dependencies
- Database admin access for migrations
- BigQuery sync process understanding
- UI/UX approval for new components
- Testing environment setup

## Risks & Mitigations
1. **Risk**: Breaking existing brand functionality
   - **Mitigation**: Feature flags and gradual rollout

2. **Risk**: Poor brand extraction accuracy
   - **Mitigation**: Manual review process and continuous improvement

3. **Risk**: Performance degradation with many brands
   - **Mitigation**: Caching and query optimization

4. **Risk**: Complex brand hierarchies
   - **Mitigation**: Start simple, add complexity gradually