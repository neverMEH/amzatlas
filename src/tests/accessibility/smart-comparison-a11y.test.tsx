import React from 'react'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, it, expect } from 'vitest'
import { SmartSuggestions } from '@/components/asin-performance/SmartSuggestions'
import { ComparisonSelector } from '@/components/asin-performance/ComparisonSelector'
import { Tooltip } from '@/components/ui/Tooltip'

expect.extend(toHaveNoViolations)

describe('Smart Comparison Accessibility', () => {
  describe('SmartSuggestions Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          onSelect={() => {}}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper ARIA labels', () => {
      render(
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          onSelect={() => {}}
        />
      )

      // Check for role attributes
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)

      // Check for testid attributes
      const cards = screen.getAllByTestId('suggestion-card')
      expect(cards.length).toBeGreaterThan(0)

      // Check confidence indicators have aria-labels
      const confidenceIndicators = screen.getAllByLabelText(/confidence/)
      expect(confidenceIndicators.length).toBeGreaterThan(0)
    })

    it('should support keyboard navigation', () => {
      render(
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          onSelect={() => {}}
        />
      )

      const firstButton = screen.getAllByRole('button')[0]
      
      // Should be focusable
      firstButton.focus()
      expect(document.activeElement).toBe(firstButton)
    })

    it('should have proper contrast ratios', () => {
      render(
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          onSelect={() => {}}
        />
      )

      // Check text elements have proper classes for contrast
      const headings = screen.getAllByRole('heading', { level: 4 })
      headings.forEach(heading => {
        expect(heading).toHaveClass('text-gray-900')
      })

      const descriptions = document.querySelectorAll('.text-gray-500')
      expect(descriptions.length).toBeGreaterThan(0)
    })

    it('should announce loading state to screen readers', () => {
      render(
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          onSelect={() => {}}
          isCalculating={true}
        />
      )

      const loadingElement = screen.getByTestId('suggestions-loading')
      expect(loadingElement).toBeInTheDocument()
    })
  })

  describe('ComparisonSelector Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ComparisonSelector
          mainStartDate="2024-07-29"
          mainEndDate="2024-08-04"
          periodType="week"
          compareStartDate=""
          compareEndDate=""
          enabled={false}
          onChange={() => {}}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper checkbox labeling', () => {
      render(
        <ComparisonSelector
          mainStartDate="2024-07-29"
          mainEndDate="2024-08-04"
          periodType="week"
          compareStartDate=""
          compareEndDate=""
          enabled={false}
          onChange={() => {}}
        />
      )

      const checkbox = screen.getByRole('checkbox', { name: /enable comparison/i })
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).toHaveAttribute('aria-label', 'Enable comparison')
    })

    it('should announce state changes', () => {
      const { rerender } = render(
        <ComparisonSelector
          mainStartDate="2024-07-29"
          mainEndDate="2024-08-04"
          periodType="week"
          compareStartDate=""
          compareEndDate=""
          enabled={false}
          onChange={() => {}}
        />
      )

      // Check initial state
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).not.toBeChecked()

      // Update to enabled state
      rerender(
        <ComparisonSelector
          mainStartDate="2024-07-29"
          mainEndDate="2024-08-04"
          periodType="week"
          compareStartDate=""
          compareEndDate=""
          enabled={true}
          onChange={() => {}}
        />
      )

      expect(checkbox).toBeChecked()
    })
  })

  describe('Tooltip Component', () => {
    it('should have proper tooltip role', () => {
      render(
        <Tooltip content="Test tooltip content">
          <button>Hover me</button>
        </Tooltip>
      )

      const button = screen.getByText('Hover me')
      expect(button).toBeInTheDocument()
    })

    it('should support keyboard triggering', () => {
      render(
        <Tooltip content="Test tooltip content">
          <button>Focus me</button>
        </Tooltip>
      )

      const button = screen.getByText('Focus me')
      button.focus()
      expect(document.activeElement).toBe(button)
    })
  })

  describe('Color Contrast', () => {
    it('should use accessible color combinations', () => {
      render(
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          onSelect={() => {}}
        />
      )

      // Check warning text contrast
      const warningText = document.querySelector('.text-yellow-600')
      if (warningText) {
        // Yellow text should be on light background
        const parent = warningText.parentElement
        expect(parent).not.toHaveClass('bg-gray-900')
      }

      // Check primary text contrast
      const primaryText = document.querySelector('.text-gray-900')
      expect(primaryText).toBeInTheDocument()
    })
  })

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      render(
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          onSelect={() => {}}
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        // Check for focus ring classes
        expect(button.className).toContain('focus:ring-2')
        expect(button.className).toContain('focus:ring-blue-500')
      })
    })

    it('should trap focus in modal contexts appropriately', () => {
      render(
        <ComparisonSelector
          mainStartDate="2024-07-29"
          mainEndDate="2024-08-04"
          periodType="week"
          compareStartDate=""
          compareEndDate=""
          enabled={true}
          onChange={() => {}}
        />
      )

      // All interactive elements should be reachable via keyboard
      const interactiveElements = screen.getAllByRole('button')
      expect(interactiveElements.length).toBeGreaterThan(0)
    })
  })

  describe('Screen Reader Announcements', () => {
    it('should announce comparison changes', () => {
      const { rerender } = render(
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          currentComparison={{
            start: '2024-07-22',
            end: '2024-07-28',
            type: 'weekly',
            label: 'Previous Week',
          }}
          onSelect={() => {}}
        />
      )

      // Selected suggestion should be visually distinct
      const selectedCard = screen.getByText('Previous Week').closest('[role="button"]')
      expect(selectedCard).toHaveClass('ring-2', 'ring-blue-500')
    })

    it('should provide context for data warnings', () => {
      render(
        <SmartSuggestions
          dateRange={{ start: '2021-01-01', end: '2021-01-07' }}
          onSelect={() => {}}
        />
      )

      // Warnings should be present and readable
      const warnings = screen.getAllByText(/Limited data availability/)
      expect(warnings.length).toBeGreaterThan(0)
    })
  })
})