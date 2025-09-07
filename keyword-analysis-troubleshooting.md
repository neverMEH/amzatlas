# Keyword Analysis Features - Troubleshooting Guide

## What You Should See

### 1. Market Share Enhancement (Single Keyword View)
When viewing a single keyword (not comparison mode), the Market Share panel should show:
- **Top 5 ASINs sorted by highest conversion rate (CVR)**
- **Three new columns**: CVR, CTR, Purchases
- **Clickable rows** that open the main dashboard with that ASIN

**Location**: Bottom-right panel when viewing a single keyword

### 2. Waterfall Chart (Comparison View)
When comparing multiple keywords:
1. Click "Compare Keywords" toggle (top-right)
2. Select keywords from the left panel
3. You'll see **4 tabs**:
   - Performance Trends
   - Conversion Funnels
   - Market Share
   - **Change Analysis** ← NEW!
4. Click "Change Analysis" tab
5. Enable comparison dates (checkbox below date picker)
6. Waterfall chart appears showing keyword changes

### 3. Real Keywords in Selector
In comparison view, the left panel now shows actual keywords from your database (top 100 by impressions)

## Troubleshooting

### If you don't see the Market Share enhancements:
1. Make sure you're in **single keyword view** (not comparison)
2. Check that data is loading (no error messages)
3. The table should show CVR, CTR, Purchases columns

### If you don't see the Change Analysis tab:
1. Switch to **Compare Keywords** mode
2. Select at least one keyword
3. The tab should appear as the 4th option

### If the waterfall chart says "No comparison period selected":
1. Check the "Compare to another period" checkbox
2. Select a comparison period from the dropdown
3. The chart should appear after data loads

## Quick Test URL
```
http://localhost:3002/keyword-analysis?asin=B08XVYZ1Y5&keyword=knife%20sharpener&startDate=2024-07-01&endDate=2024-07-31
```

## What Each Feature Shows

### Market Share Table Columns:
- **Brand**: Brand name (clickable for navigation)
- **CVR**: Conversion Rate (purchases/clicks)
- **CTR**: Click-Through Rate (clicks/impressions)
- **Purchases**: Total purchase count

### Waterfall Chart:
- Bar chart showing positive/negative changes
- Green bars = increases
- Red bars = decreases
- Sortable by various metrics
- Shows top 5/10/15/20 keywords