# Testing Keyword Analysis Features

## 1. Market Share Enhancement (Single Keyword View)

To test the Market Share enhancement:
1. Go to the keyword analysis page with a single keyword
2. Look at the Market Share section (bottom right)
3. You should see:
   - Top 5 ASINs sorted by conversion rate (CVR)
   - Additional columns: CVR, CTR, Purchases
   - Clickable rows that open the main dashboard with the ASIN selected

## 2. Waterfall Chart (Comparison View)

To test the Waterfall Chart:
1. Click "Compare Keywords" button (top right)
2. Select multiple keywords from the left panel
3. Look for 4 tabs: 
   - Performance Trends
   - Conversion Funnels
   - Market Share
   - **Change Analysis** (NEW!)
4. Click on "Change Analysis" tab
5. Enable comparison in the date picker (checkbox)
6. You should see the waterfall chart showing keyword performance changes

## 3. Date Range Fixes

The date range should work without blinking or freezing:
1. Click on the calendar icon
2. Select different period types (week, month, quarter, year)
3. The calendar should stay open and allow selection
4. Comparison toggle should work properly

## Example URL

To test all features, use a URL like:
```
http://localhost:3002/keyword-analysis?asin=B08XVYZ1Y5&keyword=knife%20sharpener&startDate=2024-07-01&endDate=2024-07-31
```

Then switch to comparison mode and select multiple keywords.