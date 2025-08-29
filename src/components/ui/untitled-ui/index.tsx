// Mock Untitled UI Components
// This file provides mock implementations of Untitled UI components
// Following the design system specifications from the technical spec

import React from 'react'
import { cn } from '@/lib/utils'

// Button Component
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variantClasses = {
      primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
      secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500',
      ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-500',
      destructive: 'bg-error-600 text-white hover:bg-error-700 focus:ring-error-500',
    }

    const sizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-4.5 py-2.5 text-md',
      xl: 'px-5 py-3 text-md',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

// Card Components
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xs transition-colors duration-200',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700', className)}
      {...props}
    />
  )
)
CardHeader.displayName = 'CardHeader'

export const CardContent = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 sm:px-6 py-4', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700', className)}
      {...props}
    />
  )
)
CardFooter.displayName = 'CardFooter'

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold text-gray-900 dark:text-gray-50', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-gray-500 dark:text-gray-400', className)}
      {...props}
    />
  )
)
CardDescription.displayName = 'CardDescription'

// Input Component
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full px-3.5 py-2.5 text-gray-900 placeholder-gray-500 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors',
        error
          ? 'border-error-300 focus:border-error-500 focus:ring-error-500'
          : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

// Badge Component
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'gray' | 'primary' | 'error' | 'warning' | 'success'
  size?: 'sm' | 'md' | 'lg'
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'gray', size = 'md', ...props }, ref) => {
    const variantClasses = {
      gray: 'bg-gray-100 text-gray-700',
      primary: 'bg-primary-100 text-primary-700',
      error: 'bg-error-100 text-error-700',
      warning: 'bg-warning-100 text-warning-700',
      success: 'bg-success-100 text-success-700',
    }

    const sizeClasses = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-sm',
      lg: 'px-3 py-1 text-sm',
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-full',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = 'Badge'

// Sheet Components (for mobile navigation)
export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const Sheet: React.FC<SheetProps> = ({ children, open, onOpenChange }) => {
  return (
    <div data-state={open ? 'open' : 'closed'}>
      {children}
    </div>
  )
}

export const SheetTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  (props, ref) => (
    <button ref={ref} {...props} />
  )
)
SheetTrigger.displayName = 'SheetTrigger'

export const SheetContent = React.forwardRef<HTMLDivElement, CardProps & { side?: 'left' | 'right' }>(
  ({ className, side = 'left', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'fixed inset-y-0 z-50 bg-white shadow-lg transition-transform',
        side === 'left' ? 'left-0' : 'right-0',
        'w-80',
        className
      )}
      {...props}
    />
  )
)
SheetContent.displayName = 'SheetContent'

// Select Component
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full px-3.5 py-2.5 text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors appearance-none',
        error
          ? 'border-error-300 focus:border-error-500 focus:ring-error-500'
          : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'

// Separator Component
export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = 'horizontal', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-gray-200 dark:bg-gray-700',
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = 'Separator'

// Text Component
export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  weight?: 'regular' | 'medium' | 'semibold' | 'bold'
}

export const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  ({ className, size = 'md', weight = 'regular', ...props }, ref) => {
    const sizeClasses = {
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-md',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
    }

    const weightClasses = {
      regular: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    }

    return (
      <p
        ref={ref}
        className={cn(
          'text-gray-900',
          sizeClasses[size],
          weightClasses[weight],
          className
        )}
        {...props}
      />
    )
  }
)
Text.displayName = 'Text'

// Avatar Component
export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      xs: 'w-6 h-6',
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
      lg: 'w-12 h-12',
      xl: 'w-14 h-14',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden rounded-full bg-gray-100',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {src ? (
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-600 font-medium text-sm">
            {alt?.charAt(0)?.toUpperCase() || '?'}
          </span>
        )}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'

// Breadcrumb Components
export interface BreadcrumbItemProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  isActive?: boolean
  isEllipsis?: boolean
}

export const BreadcrumbItem = React.forwardRef<HTMLAnchorElement, BreadcrumbItemProps>(
  ({ className, isActive, isEllipsis, children, ...props }, ref) => {
    if (isEllipsis) {
      return (
        <span className="flex items-center text-gray-400 px-1" aria-hidden="true">
          ...
        </span>
      )
    }

    if (isActive) {
      return (
        <span 
          className={cn(
            'inline-flex items-center text-sm font-medium text-gray-700 dark:text-gray-200',
            className
          )}
          aria-current="page"
        >
          {children}
        </span>
      )
    }

    return (
      <a
        ref={ref}
        className={cn(
          'inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded-sm',
          className
        )}
        {...props}
      >
        {children}
      </a>
    )
  }
)
BreadcrumbItem.displayName = 'BreadcrumbItem'

export interface BreadcrumbSeparatorProps extends React.HTMLAttributes<HTMLSpanElement> {}

export const BreadcrumbSeparator = React.forwardRef<HTMLSpanElement, BreadcrumbSeparatorProps>(
  ({ className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn('flex items-center text-gray-300 dark:text-gray-600', className)}
      aria-hidden="true"
      {...props}
    >
      {children || (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </span>
  )
)
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator'