# Header Component Integration Guide

This guide shows how to integrate the brand-aware Header component into your application.

## Basic Setup

### 1. Wrap your app with BrandProvider

In your root layout or main App component:

```tsx
// app/layout.tsx or App.tsx
import { BrandProvider } from '@/contexts/BrandContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <BrandProvider>
            {children}
          </BrandProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
```

### 2. Use Header in your pages

```tsx
// app/page.tsx or any page component
import { Header } from '@/components/layout/Header'
import { useBrand } from '@/contexts/BrandContext'

export default function DashboardPage() {
  const { selectedBrandId, setSelectedBrandId } = useBrand()

  return (
    <div>
      <Header 
        selectedBrand={selectedBrandId || undefined}
        onBrandChange={setSelectedBrandId}
      />
      
      <main>
        {selectedBrandId ? (
          <div>
            {/* Your brand-specific dashboard content */}
            <h1>Dashboard for Brand: {selectedBrandId}</h1>
          </div>
        ) : (
          <div>
            <p>Please select a brand from the header dropdown</p>
          </div>
        )}
      </main>
    </div>
  )
}
```

## Advanced Usage

### Using brand context in child components

```tsx
import { useBrand } from '@/contexts/BrandContext'

export function ProductList() {
  const { selectedBrandId } = useBrand()
  
  // Use selectedBrandId to fetch brand-specific products
  const { data: products } = useQuery({
    queryKey: ['products', selectedBrandId],
    queryFn: () => fetchProductsForBrand(selectedBrandId),
    enabled: !!selectedBrandId,
  })
  
  return (
    <div>
      {/* Render products */}
    </div>
  )
}
```

### Programmatically changing the brand

```tsx
import { useBrand } from '@/contexts/BrandContext'

export function BrandSwitcher() {
  const { setSelectedBrandId } = useBrand()
  
  const handleQuickSwitch = (brandId: string) => {
    setSelectedBrandId(brandId)
  }
  
  return (
    <button onClick={() => handleQuickSwitch('550e8400-e29b-41d4-a716-446655440000')}>
      Switch to Work Sharp
    </button>
  )
}
```

## Features

1. **Persistent Selection**: The selected brand is automatically saved to localStorage
2. **Loading States**: The BrandContext provides an `isLoading` flag while initializing
3. **Error Handling**: The Header component handles API errors gracefully
4. **Keyboard Navigation**: Full keyboard support with Enter/Escape keys
5. **Accessibility**: ARIA attributes for screen readers

## API Endpoint

The Header component expects a `/api/brands` endpoint that returns:

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "display_name": "Work Sharp"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "display_name": "Amazon Basics"
    }
  ]
}
```

This is already implemented in `/api/brands/route.ts`.