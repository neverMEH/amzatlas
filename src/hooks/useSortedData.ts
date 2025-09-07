import { useState, useMemo } from 'react'

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  key: string
  direction: SortDirection
}

export function useSortedData<T extends Record<string, any>>(
  data: T[],
  defaultSort?: SortConfig
) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(defaultSort || null)

  const sortedData = useMemo(() => {
    if (!sortConfig) {
      return data
    }

    const { key, direction } = sortConfig
    const sortedArray = [...data]

    sortedArray.sort((a, b) => {
      let aValue = a[key]
      let bValue = b[key]

      // Handle percentage strings (e.g., "32%")
      if (typeof aValue === 'string' && aValue.endsWith('%')) {
        aValue = parseFloat(aValue)
      }
      if (typeof bValue === 'string' && bValue.endsWith('%')) {
        bValue = parseFloat(bValue)
      }

      // Handle null/undefined values
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      // String comparison
      const aString = String(aValue).toLowerCase()
      const bString = String(bValue).toLowerCase()
      
      if (direction === 'asc') {
        return aString.localeCompare(bString)
      } else {
        return bString.localeCompare(aString)
      }
    })

    return sortedArray
  }, [data, sortConfig])

  const handleSort = (key: string) => {
    setSortConfig((prevConfig) => {
      if (!prevConfig || prevConfig.key !== key) {
        return { key, direction: 'desc' }
      }
      if (prevConfig.direction === 'desc') {
        return { key, direction: 'asc' }
      }
      // Remove sorting if clicking the same column third time
      return null
    })
  }

  return {
    sortedData,
    sortConfig,
    handleSort,
  }
}