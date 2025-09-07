// Mock Untitled UI Icon Components
// These are mock implementations that wrap Lucide React icons
// to simulate the Untitled UI icon library

import React from 'react'
import {
  Home,
  BarChart3,
  Settings,
  Search,
  Bell,
  User,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  TrendingUp,
  DollarSign,
  Target,
  Menu,
  X,
  Calendar,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  HelpCircle,
} from 'lucide-react'
import { LucideProps } from 'lucide-react'

// Create icon wrapper to maintain consistent API
const createIcon = (Icon: React.FC<LucideProps>) => {
  const Component = React.forwardRef<SVGSVGElement, LucideProps>(
    ({ className = '', size = 20, ...props }, ref) => (
      <Icon ref={ref} className={className} size={size} {...props} />
    )
  )
  Component.displayName = Icon.displayName || 'Icon'
  return Component
}

// Navigation Icons
export const HomeIcon = createIcon(Home)
export const ChartBarIcon = createIcon(BarChart3)
export const CogIcon = createIcon(Settings)
export const SearchIcon = createIcon(Search)
export const BellIcon = createIcon(Bell)
export const UserIcon = createIcon(User)
export const FileTextIcon = createIcon(FileText)

// Directional Icons
export const ChevronLeftIcon = createIcon(ChevronLeft)
export const ChevronRightIcon = createIcon(ChevronRight)

// Action Icons
export const FilterIcon = createIcon(Filter)
export const MenuIcon = createIcon(Menu)
export const XIcon = createIcon(X)
export const CalendarIcon = createIcon(Calendar)
export const DownloadIcon = createIcon(Download)
export const RefreshIcon = createIcon(RefreshCw)

// Business Icons
export const TrendingUpIcon = createIcon(TrendingUp)
export const DollarSignIcon = createIcon(DollarSign)
export const TargetIcon = createIcon(Target)

// Feedback Icons
export const AlertCircleIcon = createIcon(AlertCircle)
export const CheckCircleIcon = createIcon(CheckCircle)
export const InfoIcon = createIcon(Info)
export const HelpCircleIcon = createIcon(HelpCircle)

// Export all icons as a namespace for convenience
export const Icons = {
  Home: HomeIcon,
  ChartBar: ChartBarIcon,
  Cog: CogIcon,
  Search: SearchIcon,
  Bell: BellIcon,
  User: UserIcon,
  FileText: FileTextIcon,
  ChevronLeft: ChevronLeftIcon,
  ChevronRight: ChevronRightIcon,
  Filter: FilterIcon,
  Menu: MenuIcon,
  X: XIcon,
  Calendar: CalendarIcon,
  Download: DownloadIcon,
  Refresh: RefreshIcon,
  TrendingUp: TrendingUpIcon,
  DollarSign: DollarSignIcon,
  Target: TargetIcon,
  AlertCircle: AlertCircleIcon,
  CheckCircle: CheckCircleIcon,
  Info: InfoIcon,
  HelpCircle: HelpCircleIcon,
}