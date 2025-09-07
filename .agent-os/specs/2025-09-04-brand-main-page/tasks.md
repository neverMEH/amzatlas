# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-04-brand-main-page/spec.md

> Created: 2025-09-04
> Status: Ready for Implementation

## Tasks

- [ ] 1. Set up brand selector in header and brand context management
  - [ ] 1.1 Write tests for Header component with brand selector dropdown
  - [ ] 1.2 Adapt Header.tsx from sample-dash to integrate with existing navigation
  - [ ] 1.3 Create brand context provider for state management
  - [ ] 1.4 Implement /api/brands endpoint to fetch available brands
  - [ ] 1.5 Add localStorage persistence for selected brand
  - [ ] 1.6 Verify all header and brand selector tests pass

- [ ] 2. Implement KPI summary cards with sparkline visualizations
  - [ ] 2.1 Write tests for KpiModules component
  - [ ] 2.2 Adapt KpiModules.tsx from sample-dash with real data integration
  - [ ] 2.3 Create sparkline data generation utility for trend visualization
  - [ ] 2.4 Integrate with dashboard API for KPI data
  - [ ] 2.5 Add comparison mode support to show/hide percentage changes
  - [ ] 2.6 Verify all KPI module tests pass

- [ ] 3. Build product list table with comprehensive metrics
  - [ ] 3.1 Write tests for ProductList and ProductListItem components
  - [ ] 3.2 Adapt ProductList.tsx from sample-dash with API integration
  - [ ] 3.3 Implement share metrics calculations (impression share, CTR share, etc.)
  - [ ] 3.4 Add sorting functionality for all columns
  - [ ] 3.5 Implement pagination with 7-10 items per page
  - [ ] 3.6 Add click navigation to ASIN performance dashboard
  - [ ] 3.7 Integrate comparison indicators for all metrics
  - [ ] 3.8 Verify all product list tests pass

- [ ] 4. Create search query performance table
  - [ ] 4.1 Write tests for SearchQueryList component
  - [ ] 4.2 Adapt SearchQueryList.tsx from sample-dash
  - [ ] 4.3 Implement brand-level keyword aggregation logic
  - [ ] 4.4 Add sorting and pagination for search queries
  - [ ] 4.5 Integrate comparison mode indicators
  - [ ] 4.6 Verify all search query list tests pass

- [ ] 5. Complete dashboard API integration and database setup
  - [ ] 5.1 Write tests for /api/brands/[brandId]/dashboard endpoint
  - [ ] 5.2 Create database migration for share metrics materialized views
  - [ ] 5.3 Implement dashboard API endpoint with all required data aggregation
  - [ ] 5.4 Add response caching with 2-minute TTL
  - [ ] 5.5 Implement error handling and fallback responses
  - [ ] 5.6 Test API performance with full brand data
  - [ ] 5.7 Verify all API integration tests pass