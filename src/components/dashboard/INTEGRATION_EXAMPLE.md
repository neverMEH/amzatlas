# KpiModules Integration Guide

This guide shows how to integrate the KpiModules component with the brand dashboard API.

## Basic Usage

### 1. Using KpiModules in a brand dashboard

```tsx
import { useQuery } from '@tanstack/react-query'
import { KpiModules } from '@/components/dashboard/KpiModules'
import { useBrand } from '@/contexts/BrandContext'

export function BrandDashboard() {
  const { selectedBrandId } = useBrand()
  const [showComparison, setShowComparison] = useState(false)
  
  // Fetch dashboard data
  const { data, isLoading, error } = useQuery({
    queryKey: ['brand-dashboard', selectedBrandId],
    queryFn: async () => {
      const response = await fetch(`/api/brands/${selectedBrandId}/dashboard`)
      if (!response.ok) throw new Error('Failed to fetch dashboard')
      return response.json()
    },
    enabled: !!selectedBrandId,
  })
  
  return (
    <div>
      {/* Comparison toggle */}
      <button onClick={() => setShowComparison(!showComparison)}>
        Toggle Comparison
      </button>
      
      {/* KPI Cards */}
      <KpiModules 
        data={data?.data}
        showComparison={showComparison}
        loading={isLoading}
        error={error?.message}
      />
      
      {/* Rest of dashboard... */}
    </div>
  )
}
```

### 2. With date range and comparison periods

```tsx
export function BrandDashboardWithDates() {
  const { selectedBrandId } = useBrand()
  const [dateRange, setDateRange] = useState({
    from: '2025-01-01',
    to: '2025-01-31'
  })
  const [comparisonRange, setComparisonRange] = useState({
    from: '2024-12-01',
    to: '2024-12-31'
  })
  const [showComparison, setShowComparison] = useState(true)
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['brand-dashboard', selectedBrandId, dateRange, comparisonRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        date_from: dateRange.from,
        date_to: dateRange.to,
        comparison_date_from: comparisonRange.from,
        comparison_date_to: comparisonRange.to,
      })
      
      const response = await fetch(
        `/api/brands/${selectedBrandId}/dashboard?${params}`
      )
      if (!response.ok) throw new Error('Failed to fetch dashboard')
      return response.json()
    },
    enabled: !!selectedBrandId,
  })
  
  return <KpiModules data={data?.data} showComparison={showComparison} />
}
```

## API Response Format

The brand dashboard API returns data in this format:

```typescript
{
  data: {
    kpis: {
      impressions: { value: 24500, trend: number[], comparison?: 12.3 },
      clicks: { value: 4585, trend: number[], comparison?: 8.7 },
      cartAdds: { value: 1080, trend: number[], comparison?: -3.2 },
      purchases: { value: 631, trend: number[], comparison?: 15.4 }
    },
    products: [...],
    searchQueries: [...]
  }
}
```

## Sparkline Trends

The `trend` arrays contain 20 data points representing the metric over time. These are automatically generated from daily data and evenly distributed across the date range.

## Features

1. **Loading States**: Shows skeleton cards while data is loading
2. **Error Handling**: Displays error message if API call fails
3. **Comparison Mode**: Toggle to show/hide percentage change badges
4. **Responsive Design**: 1 column on mobile, 4 columns on desktop
5. **Number Formatting**: Automatic locale-based number formatting
6. **Trend Visualization**: SVG sparklines showing metric trends

## Styling

The component uses TailwindCSS classes and follows the design system:
- Green badges for positive changes
- Red badges for negative changes
- Blue sparklines for positive trends
- Red sparklines for negative trends