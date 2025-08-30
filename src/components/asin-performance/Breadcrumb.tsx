import React from 'react'
import { Home, ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
  icon?: 'home'
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-2 text-sm ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const isLink = item.href && (items.length === 1 || !isLast)

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight 
                className="h-4 w-4 text-gray-400" 
                data-testid="breadcrumb-separator"
              />
            )}
            
            {isLink ? (
              <a 
                href={item.href} 
                className="text-gray-500 hover:text-gray-700 flex items-center transition-colors"
              >
                {item.icon === 'home' && (
                  <Home 
                    className="h-4 w-4 mr-1" 
                    data-testid="breadcrumb-home-icon"
                  />
                )}
                {item.label}
              </a>
            ) : (
              <span className={isLast ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                {item.icon === 'home' && (
                  <Home 
                    className="h-4 w-4 mr-1 inline" 
                    data-testid="breadcrumb-home-icon"
                  />
                )}
                {item.label}
              </span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}