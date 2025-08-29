import { describe, it, expect, beforeAll, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock the Untitled UI components for now
vi.mock('@untitled-ui/react', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Input: (props: any) => <input {...props} />,
  Select: ({ children, ...props }: any) => <select {...props}>{children}</select>,
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Sheet: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SheetContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SheetTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('@untitled-ui/icons-react', () => ({
  HomeIcon: () => <svg data-testid="home-icon" />,
  ChartBarIcon: () => <svg data-testid="chart-bar-icon" />,
  CogIcon: () => <svg data-testid="cog-icon" />,
  SearchIcon: () => <svg data-testid="search-icon" />,
}))

describe('Untitled UI Library Integration', () => {
  describe('Component Imports', () => {
    it('should successfully import UI components', async () => {
      const UntitledUI = await import('@untitled-ui/react')
      expect(UntitledUI.Button).toBeDefined()
      expect(UntitledUI.Card).toBeDefined()
      expect(UntitledUI.Input).toBeDefined()
      expect(UntitledUI.Select).toBeDefined()
    })

    it('should successfully import icon components', async () => {
      const UntitledIcons = await import('@untitled-ui/icons-react')
      expect(UntitledIcons.HomeIcon).toBeDefined()
      expect(UntitledIcons.ChartBarIcon).toBeDefined()
      expect(UntitledIcons.CogIcon).toBeDefined()
    })
  })

  describe('Component Rendering', () => {
    it('should render Button component', () => {
      const { Button } = require('@untitled-ui/react')
      render(<Button>Click me</Button>)
      expect(screen.getByText('Click me')).toBeInTheDocument()
    })

    it('should render Card components', () => {
      const { Card, CardHeader, CardContent } = require('@untitled-ui/react')
      render(
        <Card>
          <CardHeader>Card Title</CardHeader>
          <CardContent>Card Content</CardContent>
        </Card>
      )
      expect(screen.getByText('Card Title')).toBeInTheDocument()
      expect(screen.getByText('Card Content')).toBeInTheDocument()
    })

    it('should render Icon components', () => {
      const { HomeIcon } = require('@untitled-ui/icons-react')
      render(<HomeIcon />)
      expect(screen.getByTestId('home-icon')).toBeInTheDocument()
    })
  })

  describe('Tailwind Configuration', () => {
    it('should have Untitled UI design tokens available', () => {
      // This test will verify that our Tailwind config includes Untitled UI tokens
      const tailwindConfig = require('../../tailwind.config.ts').default
      
      // Check for Untitled UI color system
      expect(tailwindConfig.theme.extend.colors.gray).toBeDefined()
      expect(tailwindConfig.theme.extend.colors.primary).toBeDefined()
      expect(tailwindConfig.theme.extend.colors.error).toBeDefined()
      expect(tailwindConfig.theme.extend.colors.warning).toBeDefined()
      expect(tailwindConfig.theme.extend.colors.success).toBeDefined()
      
      // Check for Untitled UI typography
      expect(tailwindConfig.theme.extend.fontSize['display-2xl']).toBeDefined()
      expect(tailwindConfig.theme.extend.fontSize['text-md']).toBeDefined()
      
      // Check for Untitled UI shadows
      expect(tailwindConfig.theme.extend.boxShadow.xs).toBeDefined()
      expect(tailwindConfig.theme.extend.boxShadow['2xl']).toBeDefined()
    })
  })
})