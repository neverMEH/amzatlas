# Spec Requirements Document

> Spec: Brand-Centric Performance Dashboard
> Created: 2025-09-04

## Overview

Transform the current single-ASIN dashboard into a brand-centric performance dashboard that displays all products (ASINs) for a selected brand in a comprehensive table view with key performance metrics. This provides immediate visibility into the entire product portfolio while maintaining quick access to detailed ASIN analysis through clickable rows.

## User Stories

### Brand Portfolio Overview

As a brand manager, I want to see all my brand's products in a single table view with key performance metrics, so that I can quickly identify top performers and products needing attention without navigating through individual ASIN dropdowns.

The dashboard will display a complete product list table showing all ASINs for the selected brand with metrics including impressions, clicks, cart adds, purchases, CTR, CVR, and market share metrics. Each product row includes comparison indicators when comparison mode is enabled, making it easy to spot trends across the entire portfolio.

### Quick Brand Switching

As an agency user managing multiple brands, I want to switch between brands using a header dropdown, so that I can efficiently analyze different client portfolios while maintaining my current view settings and date selections.

A brand selector dropdown in the header allows instant switching between brands. The selected brand context persists, and all dashboard components update to show data for the newly selected brand without losing date range or comparison settings.

### Integrated Search Query Analysis

As a product analyst, I want to see search query performance below the product list, so that I can understand which keywords are driving traffic and conversions across all my brand's products.

Below the product list, a search query table displays aggregated keyword performance across all brand ASINs, showing which search terms generate the most impressions, clicks, and conversions for the brand as a whole.

## Spec Scope

1. **Brand Selector Dropdown** - Header-based brand switcher replacing the current ASIN dropdown
2. **KPI Summary Cards** - Four metric cards showing brand-level totals with sparkline visualizations
3. **Product List Table** - Comprehensive ASIN table with 13+ performance columns and comparison indicators
4. **Search Query Table** - Keyword performance table aggregated across all brand products
5. **Comparison Mode** - Toggle to enable/disable period-over-period comparison indicators
6. **Date Range Selector** - Unified date picker affecting all dashboard components
7. **Share Metrics** - Include market share calculations for impressions, CTR, CVR, cart adds, and purchases
8. **Clickable Navigation** - Product rows link to detailed ASIN performance dashboards

## Out of Scope

- Multi-brand comparison views
- Real-time data updates or auto-refresh
- Export/download functionality
- Custom metric calculations or formula editor
- User-specific saved views or preferences
- Mobile-specific responsive design (desktop-first approach)
- Advanced filtering beyond basic search

## Expected Deliverable

1. Brand selector dropdown in header shows all available brands with current brand highlighted
2. Product list displays all ASINs for selected brand with sortable columns and pagination
3. Clicking a product row navigates to the existing ASIN performance dashboard
4. KPI cards update to show brand-level aggregates with mini sparkline charts
5. Search query table shows top keywords across all brand products
6. Comparison toggle shows/hides percentage change indicators throughout the dashboard