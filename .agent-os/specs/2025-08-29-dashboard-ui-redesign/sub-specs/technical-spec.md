# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-29-dashboard-ui-redesign/spec.md

> Created: 2025-08-29
> Version: 1.0.0

## Technical Requirements

### Navigation Component Architecture

#### Sidebar Navigation (`NavigationSidebar`)
```typescript
interface NavigationSidebarProps {
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
  activeSection?: string;
  userProfile?: UserProfile;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  href: string;
  badge?: string | number;
  children?: NavigationItem[];
  permissions?: string[];
}
```

**Key Features:**
- Collapsible sidebar with smooth transitions
- Hierarchical navigation with expandable sections  
- Active state management with visual indicators
- User profile section with avatar and quick actions
- Responsive behavior (overlay on mobile, persistent on desktop)
- Keyboard navigation support (Tab, Enter, Escape)

#### Top Navigation (`TopNavigation`)
```typescript
interface TopNavigationProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ActionButton[];
  searchEnabled?: boolean;
  notificationsEnabled?: boolean;
}

interface Breadcrumb {
  label: string;
  href?: string;
  isActive?: boolean;
}
```

**Key Features:**
- Dynamic page title and breadcrumb navigation
- Global search functionality with keyboard shortcuts
- Notifications center with real-time updates
- Quick actions menu (user settings, help, logout)
- Mobile hamburger menu integration

### Component Replacement Mapping

#### Core Layout Components
- **Current:** `src/components/ui/` components → **Target:** Untitled UI library components
- **Current:** Custom CSS classes → **Target:** Untitled UI design tokens and utility classes

#### Specific Component Migrations
```typescript
// Before: Custom metric cards
<MetricCard title="Revenue" value="$12,345" />

// After: Untitled UI components
<Card className="metric-card">
  <CardHeader>
    <CardTitle className="text-gray-600 text-sm">Revenue</CardTitle>
  </CardHeader>
  <CardContent>
    <Text size="2xl" weight="semibold">$12,345</Text>
  </CardContent>
</Card>
```

#### Dashboard Component Mapping
- `MetricCard` → `Card` + `CardHeader` + `CardContent` + `Badge`
- `DataTable` → `Table` + `TableHeader` + `TableBody` + `TableRow` + `TableCell`
- `ChartContainer` → `Card` + `CardContent` + custom chart integration
- `FilterPanel` → `Sheet` + `SheetContent` + `Select` + `DatePicker`
- `SearchBar` → `Input` + `InputIcon` + `Command`

### State Management Approach

#### Context Architecture
```typescript
// Dashboard context for global state
interface DashboardContextType {
  layout: LayoutState;
  filters: FilterState;
  metrics: MetricsState;
  navigation: NavigationState;
}

// Layout state management
interface LayoutState {
  sidebarCollapsed: boolean;
  activeSection: string;
  pageTitle: string;
  breadcrumbs: Breadcrumb[];
}

// Filter state for dashboard data
interface FilterState {
  dateRange: DateRange;
  selectedAsins: string[];
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}
```

#### State Persistence
- Use `localStorage` for sidebar collapse preference
- URL-based state for filters and navigation
- Session storage for temporary filter states
- React Query cache for API data management

#### Performance Optimization
- Implement debounced search with 300ms delay
- Use React.memo for expensive dashboard components
- Lazy loading for chart components and large data tables
- Virtual scrolling for tables with 1000+ rows

### Responsive Design Requirements

#### Breakpoint Strategy
```scss
// Tailwind CSS breakpoints
sm: 640px   // Mobile landscape, small tablets
md: 768px   // Tablets
lg: 1024px  // Desktop
xl: 1280px  // Large desktop
2xl: 1536px // Extra large desktop
```

#### Layout Behavior
- **Mobile (< 768px):**
  - Sidebar converts to overlay modal
  - Top navigation shows hamburger menu
  - Cards stack vertically with full width
  - Tables scroll horizontally
  - Charts resize to fit viewport

- **Tablet (768px - 1023px):**
  - Sidebar remains persistent but narrower
  - Two-column grid for metric cards
  - Tables maintain structure with smaller text
  - Charts adapt to available space

- **Desktop (≥ 1024px):**
  - Full sidebar with labels visible
  - Multi-column grid layouts (3-4 columns)
  - Full table functionality
  - Charts optimized for larger screens

#### Touch and Mobile Optimizations
- Minimum touch target size: 44px × 44px
- Swipe gestures for sidebar on mobile
- Pull-to-refresh functionality
- Optimized keyboard on mobile devices
- Haptic feedback for interactive elements

### Performance Criteria

#### Core Web Vitals Targets
- **Largest Contentful Paint (LCP):** < 2.5s
- **First Input Delay (FID):** < 100ms
- **Cumulative Layout Shift (CLS):** < 0.1

#### Bundle Size Requirements
- Main bundle: < 250KB gzipped
- Initial page load: < 1MB total resources
- Code splitting by route with < 100KB per route
- Image optimization with WebP format

#### Runtime Performance
- Dashboard data refresh: < 1s response time
- Chart rendering: < 500ms for complex visualizations
- Table pagination: < 200ms
- Search results: < 300ms with debouncing
- Navigation transitions: < 150ms

#### Caching Strategy
- Static assets: 1 year cache
- API responses: 5 minutes cache with stale-while-revalidate
- User preferences: localStorage with fallbacks
- Chart data: 1 minute cache for real-time updates

### External Dependencies

#### Untitled UI Library Integration
```json
{
  "@untitled-ui/icons-react": "^1.0.0",
  "@untitled-ui/react": "^1.0.0",
  "@untitled-ui/tailwind-config": "^1.0.0"
}
```

#### Component Library Structure
```typescript
// Core components from Untitled UI
import {
  Button,
  Card, CardHeader, CardContent, CardFooter,
  Input, Select, DatePicker,
  Table, TableHeader, TableBody, TableRow, TableCell,
  Sheet, SheetTrigger, SheetContent,
  Badge, Avatar, Separator,
  Command, CommandInput, CommandItem,
  Popover, PopoverTrigger, PopoverContent,
  Dialog, DialogTrigger, DialogContent,
  Tooltip, TooltipProvider, TooltipTrigger, TooltipContent
} from '@untitled-ui/react';

// Icons from Untitled UI icon set
import {
  ChartBarIcon,
  CogIcon,
  HomeIcon,
  SearchIcon,
  BellIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon
} from '@untitled-ui/icons-react';
```

#### Configuration Setup
```typescript
// tailwind.config.ts
import { untitledUIConfig } from '@untitled-ui/tailwind-config';

export default {
  ...untitledUIConfig,
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@untitled-ui/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      ...untitledUIConfig.theme.extend,
      // Custom SQP Intelligence brand colors
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        }
      }
    }
  }
};
```

#### Chart Integration
```typescript
// Chart.js with Untitled UI styling
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Apply Untitled UI theme to charts
const chartTheme = {
  colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontColor: '#6b7280'
};
```

#### Additional Dependencies
```json
{
  "date-fns": "^2.30.0",
  "react-query": "^3.39.0",
  "react-hot-toast": "^2.4.0",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.0.0",
  "tailwind-merge": "^1.14.0"
}
```

### Implementation Phases

#### Phase 1: Core Infrastructure (Week 1)
- Set up Untitled UI library and configuration
- Implement base layout components (NavigationSidebar, TopNavigation)
- Create design system integration layer
- Establish state management context

#### Phase 2: Component Migration (Week 2)
- Replace existing dashboard components with Untitled UI variants
- Implement responsive grid system
- Add keyboard navigation and accessibility features
- Create reusable chart wrapper components

#### Phase 3: Advanced Features (Week 3)
- Implement advanced filtering and search
- Add data export functionality
- Create user preference management
- Performance optimization and testing

#### Phase 4: Polish and Testing (Week 4)
- Cross-browser testing and bug fixes
- Performance audits and optimizations
- Accessibility compliance verification
- User acceptance testing and feedback integration

### Testing Strategy

#### Unit Testing
- Component isolation testing with Jest and React Testing Library
- State management testing for context providers
- Utility function testing for data transformations
- Mock external dependencies and API calls

#### Integration Testing
- End-to-end user workflows with Playwright
- API integration testing
- Cross-component interaction testing
- Performance regression testing

#### Accessibility Testing
- Automated a11y testing with axe-core
- Keyboard navigation testing
- Screen reader compatibility
- Color contrast verification

### Migration Considerations

#### Backward Compatibility
- Implement feature flags for gradual rollout
- Maintain existing API contracts
- Provide fallbacks for unsupported browsers
- Create migration guide for custom components

#### Data Migration
- Ensure existing dashboard data remains accessible
- Maintain filter and preference continuity
- Preserve user customizations where possible
- Create data validation for new component requirements