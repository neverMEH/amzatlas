'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface KeywordAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  onExpand: () => void
  keyword: string
  asin: string
  dateRange: { start: string; end: string }
  comparisonDateRange?: { start: string; end: string }
  isLoading?: boolean
  error?: Error | null
}

function formatDateRange(start: string, end: string): string {
  return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d, yyyy')}`
}

export function KeywordAnalysisModal({
  isOpen,
  onClose,
  onExpand,
  keyword,
  asin,
  dateRange,
  comparisonDateRange,
  isLoading = false,
  error = null,
}: KeywordAnalysisModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const expandButtonRef = useRef<HTMLButtonElement>(null)

  // Handle open/close with animation
  useEffect(() => {
    if (isOpen) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement
      
      // Show modal
      setIsVisible(true)
      
      // Start animation after a frame
      requestAnimationFrame(() => {
        setIsAnimating(true)
        
        // Focus close button after another frame to ensure DOM is ready
        requestAnimationFrame(() => {
          closeButtonRef.current?.focus()
        })
      })
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
    } else {
      // Start close animation
      setIsAnimating(false)
      
      // Hide after animation
      const timeout = setTimeout(() => {
        setIsVisible(false)
        
        // Restore focus
        previousFocusRef.current?.focus()
      }, 200) // Match transition duration
      
      // Restore body scroll
      document.body.style.overflow = ''
      
      return () => clearTimeout(timeout)
    }
  }, [isOpen])

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = modalRef.current!.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleTabKey)
    return () => document.removeEventListener('keydown', handleTabKey)
  }, [isOpen])

  if (!isVisible) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden transform transition-all duration-200 ${
          isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex-1">
            <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
              Keyword Analysis: {keyword}
            </h2>
            <div className="mt-1 text-sm text-gray-500">
              ASIN: {asin} • {formatDateRange(dateRange.start, dateRange.end)}
              {comparisonDateRange && (
                <span className="ml-2">
                  vs {formatDateRange(comparisonDateRange.start, comparisonDateRange.end)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <button
              ref={expandButtonRef}
              onClick={onExpand}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Expand to new tab"
              tabIndex={0}
            >
              <ExternalLink className="h-5 w-5" />
            </button>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close modal"
              tabIndex={0}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {isLoading ? (
            <div className="animate-pulse" data-testid="modal-skeleton">
              <div className="h-64 bg-gray-200 rounded mb-4"></div>
              <div className="h-32 bg-gray-200 rounded mb-4"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <p className="text-red-800 font-medium">Error loading keyword data</p>
              <p className="text-red-600 text-sm mt-1">{error.message}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Placeholder for charts and data */}
              <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                <p className="text-lg font-medium mb-2">Performance Charts</p>
                <p className="text-sm">Time series charts and metrics will be displayed here</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                <p className="text-lg font-medium mb-2">Conversion Funnel</p>
                <p className="text-sm">Keyword-specific funnel visualization will be displayed here</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                <p className="text-lg font-medium mb-2">Market Share Analysis</p>
                <p className="text-sm">Competitive analysis for this keyword will be displayed here</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                <p className="text-lg font-medium mb-2">Multi-Keyword Comparison</p>
                <p className="text-sm">Select up to 10 keywords for comparison</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // Use portal to render at document root
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return null
}