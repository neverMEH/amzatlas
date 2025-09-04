# Design Specification

This is the design specification for the spec detailed in @.agent-os/specs/2025-09-04-brand-main-page/spec.md

> Created: 2025-09-04
> Version: 1.0.0

## Design System Reference

The complete UI implementation reference is available in the sample dashboard located at:
**@.agent-os/specs/2025-09-04-brand-main-page/sample-dash/**

This React/TypeScript sample application demonstrates all required components, styling patterns, and interactions for the brand-centric dashboard implementation.

## Component Implementation Reference

### Header Component
**Reference**: `sample-dash/src/components/Header.tsx`

- **Brand Selector Dropdown**: Fully functional brand switcher with state management
- **Logo Integration**: AMZ Atlas branding with SVG icon and blue accent styling
- **User Profile**: Avatar and user icon implementation
- **Layout**: Flexbox header with proper spacing and responsive considerations

**Key Features**:
- Dropdown toggle functionality with proper z-index layering
- Selected brand persistence in component state
- Clean brand list rendering with hover states
- Professional header styling with border separator

### KPI Dashboard Cards
**Reference**: `sample-dash/src/components/KpiModules.tsx`

- **Four Metric Cards**: Impressions, Clicks, Cart Adds, Purchases
- **Sparkline Visualizations**: SVG-based mini trend charts (20 data points)
- **Comparison Indicators**: Green/red percentage badges with conditional display
- **Number Formatting**: Locale-aware formatting with proper digit grouping

**Key Features**:
- Dynamic sparkline path generation from data arrays
- Conditional comparison badge rendering based on `showComparison` prop
- Consistent card styling with shadow and border treatments
- Responsive grid layout (1-4 columns based on screen size)

### Product List Table
**Reference**: `sample-dash/src/components/ProductList.tsx`

- **Comprehensive Data Table**: 13+ columns with full product metrics
- **Row Component**: Modular `ProductListItem.tsx` for table row rendering
- **Comparison Integration**: Conditional percentage indicators in each cell
- **Pagination Controls**: Bottom navigation with page indicators

**Key Features**:
- Checkbox selection column for multi-product actions
- Product image thumbnails with consistent sizing
- Share metric columns (Impression, CVR, CTR, Cart Add, Purchase shares)
- Sortable column headers with proper accessibility
- Table overflow handling with horizontal scroll

### Search Query List
**Reference**: `sample-dash/src/components/SearchQueryList.tsx`

- **Keyword Performance Table**: Similar structure to product list
- **Query-Specific Metrics**: Aggregated performance across brand ASINs
- **List Item Component**: Modular `SearchQueryListItem.tsx` implementation
- **Consistent Styling**: Matches product table design patterns

### Date Range Selector
**Reference**: `sample-dash/src/components/DateRangeSelector.tsx`

- **Comparison Toggle**: Enable/disable comparison mode functionality
- **Date Input Integration**: Proper form controls for date selection
- **State Management**: Callback pattern for parent component updates

### Comparison Indicators
**Reference**: `sample-dash/src/components/ComparisonIndicator.tsx`

- **Percentage Badges**: Reusable component for trend indicators
- **Color Coding**: Green for positive, red for negative changes
- **Formatting**: Proper +/- prefix handling and percentage display

## Styling Standards

### Color Palette
- **Primary Blue**: `#3B82F6` (blue-600), `#DBEAFE` (blue-100)
- **Success Green**: `#F0FDF4` (green-50), `#16A34A` (green-600)
- **Error Red**: `#FEF2F2` (red-50), `#DC2626` (red-600)
- **Neutral Gray**: `#F9FAFB` (gray-50), `#6B7280` (gray-500), `#1F2937` (gray-900)
- **Background**: `#F9FAFB` (gray-50) for page background

### Typography
- **Font Family**: System font stack (default Tailwind)
- **Headers**: `font-semibold` for section titles, `font-medium` for table headers
- **Body Text**: Regular weight for data cells and content
- **Size Scale**: `text-xs` (table headers), `text-sm` (body), `text-xl` (page titles), `text-2xl` (KPI values)

### Spacing & Layout
- **Container**: `container mx-auto px-4 py-6` for main content area
- **Card Padding**: `p-4` for KPI cards, `p-6` for larger containers
- **Grid Gaps**: `gap-4` for KPI grid, `space-x-8` for header items
- **Table Spacing**: `px-3 py-3` for cell padding

### Shadows & Borders
- **Card Shadows**: `shadow-sm` for subtle elevation
- **Dropdown Shadows**: `shadow-lg` for overlay elements
- **Borders**: `border border-gray-200` for card outlines
- **Table Borders**: `divide-y divide-gray-200` for row separation

### Interactive States
- **Hover Effects**: `hover:bg-gray-100` for clickable items
- **Focus States**: `focus:ring-blue-500` for form inputs
- **Active States**: `bg-gray-900 text-white` for selected pagination buttons
- **Disabled States**: `text-gray-500` for inactive controls

## Responsive Design

### Desktop-First Approach
- **Primary Target**: 1920px desktop resolution
- **Minimum Width**: 1024px (no mobile optimization required)
- **Grid Breakpoints**: `md:` prefix for responsive adjustments

### Layout Adaptations
- **Header**: Collapsible brand selector on smaller screens
- **KPI Cards**: 1-4 column responsive grid
- **Tables**: Horizontal scroll for overflow content
- **Navigation**: Consistent spacing across screen sizes

## Animation & Transitions

### Micro-interactions
- **Dropdown Animations**: Smooth open/close transitions
- **Hover States**: Subtle background color transitions
- **Loading States**: Skeleton states for data loading (future implementation)

### Performance Considerations
- **CSS Transitions**: Use for simple state changes
- **Avoid Heavy Animations**: Focus on functional animations only
- **Sparkline Rendering**: SVG-based for optimal performance

## Accessibility Standards

### Keyboard Navigation
- **Tab Order**: Logical tab sequence through interactive elements
- **Focus Indicators**: Visible focus states for all controls
- **Escape Key**: Close dropdown and modal states

### Screen Reader Support
- **Table Headers**: Proper `scope` attributes for data tables
- **Button Labels**: Descriptive labels for icon-only buttons
- **Form Labels**: Associated labels for all input controls

### Color Contrast
- **WCAG Compliance**: Meets AA standards for color contrast
- **Status Indicators**: Not solely dependent on color (includes icons/text)

## Implementation Notes

### Component Architecture
- **Prop Interface**: Each component has well-defined TypeScript interfaces
- **State Management**: Local state for UI, global state for data
- **Event Handling**: Callback pattern for parent-child communication

### Data Integration Points
- **Mock Data**: Sample components include realistic test data
- **API Integration**: Components designed for easy API data binding
- **Loading States**: Structure supports loading and error states

### Performance Optimization
- **Component Splitting**: Modular design for code splitting
- **Memo Optimization**: Strategic use of React.memo for expensive renders
- **Lazy Loading**: Image loading optimization for product thumbnails

## Files Structure Reference

```
sample-dash/src/
├── components/
│   ├── Header.tsx                    # Brand selector & navigation
│   ├── KpiModules.tsx               # Four metric cards with sparklines
│   ├── ProductList.tsx              # Product performance table
│   ├── ProductListItem.tsx          # Individual product row
│   ├── SearchQueryList.tsx          # Keyword performance table
│   ├── SearchQueryListItem.tsx      # Individual query row
│   ├── DateRangeSelector.tsx        # Date picker with comparison
│   └── ComparisonIndicator.tsx      # Percentage change badges
├── App.tsx                          # Main layout and state orchestration
└── AppRouter.tsx                    # Routing configuration
```

Each component in the sample dashboard provides a complete implementation reference for the corresponding feature in the main application, including styling, interaction patterns, and data structure requirements.