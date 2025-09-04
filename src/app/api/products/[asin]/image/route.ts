import { NextRequest, NextResponse } from 'next/server'

interface ProductImageParams {
  params: {
    asin: string
  }
}

// Generate a placeholder image URL based on ASIN
function getPlaceholderImageUrl(asin: string): string {
  // Use a placeholder service with ASIN as seed for consistent images
  const colors = ['3B82F6', '10B981', '8B5CF6', 'F59E0B', 'EF4444', '6366F1']
  const colorIndex = asin.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  const color = colors[colorIndex]
  
  // Use placeholder service
  return `https://via.placeholder.com/150/${color}/FFFFFF?text=${encodeURIComponent(asin.substring(0, 4))}`
}

export async function GET(
  request: NextRequest,
  { params }: ProductImageParams
) {
  try {
    const { asin } = params
    
    if (!asin) {
      return NextResponse.json(
        { error: { code: 'MISSING_ASIN', message: 'ASIN parameter is required' } },
        { status: 400 }
      )
    }
    
    // In a real implementation, this would fetch from a database or storage service
    // For now, redirect to a placeholder image
    const imageUrl = getPlaceholderImageUrl(asin)
    
    // Redirect to the placeholder image
    return NextResponse.redirect(imageUrl)
  } catch (error) {
    console.error('Error in product image API:', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch product image' } },
      { status: 500 }
    )
  }
}