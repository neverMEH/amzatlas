import { chromium } from 'playwright'

async function testKeywordAnalysisPerformance() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Enable performance tracking
  await page.evaluateOnNewDocument(() => {
    window.performanceMetrics = {
      modalClickTime: 0,
      modalVisibleTime: 0,
      chartsStartTime: 0,
      chartsRenderedTime: 0,
    }
  })

  try {
    console.log('🚀 Starting keyword analysis performance test...\n')

    // Navigate to the main page
    await page.goto('http://localhost:3000')
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle')

    // Select an ASIN (you'll need to adjust this based on available ASINs)
    await page.click('[data-testid="asin-selector"]')
    await page.click('[data-testid="asin-option"]:first-child')
    
    // Wait for data to load
    await page.waitForSelector('[data-testid="search-query-table"]', { timeout: 10000 })

    // Set up performance tracking for modal
    await page.evaluate(() => {
      // Track when keyword is clicked
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        if (target.closest('[role="button"]') && target.textContent?.trim()) {
          window.performanceMetrics.modalClickTime = performance.now()
        }
      })

      // Track when modal becomes visible
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            const modal = document.querySelector('[data-testid="modal-content"]')
            if (modal && window.performanceMetrics.modalVisibleTime === 0) {
              window.performanceMetrics.modalVisibleTime = performance.now()
            }
          }
        })
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })

    // Click on the first keyword
    const firstKeyword = await page.locator('[role="button"][tabindex="0"]').first()
    await firstKeyword.click()

    // Wait for modal to appear
    await page.waitForSelector('[data-testid="modal-content"]', { timeout: 1000 })

    // Get modal appearance time
    const modalMetrics = await page.evaluate(() => {
      const clickTime = window.performanceMetrics.modalClickTime
      const visibleTime = window.performanceMetrics.modalVisibleTime
      return {
        modalAppearTime: visibleTime - clickTime
      }
    })

    console.log(`✅ Modal appearance time: ${modalMetrics.modalAppearTime.toFixed(2)}ms`)
    console.log(`   ${modalMetrics.modalAppearTime <= 300 ? '✓' : '✗'} Target: < 300ms\n`)

    // Click expand button to go to full page
    await page.click('[aria-label="Expand to new tab"]')
    
    // Wait for navigation
    await page.waitForURL('**/keyword-analysis**')
    
    // Track chart render time
    const chartRenderStart = await page.evaluate(() => performance.now())
    
    // Wait for charts to render
    await Promise.all([
      page.waitForSelector('[data-testid="keyword-performance-chart"]', { timeout: 2000 }),
      page.waitForSelector('[data-testid="keyword-funnel-chart"]', { timeout: 2000 }),
      page.waitForSelector('[data-testid="keyword-market-share"]', { timeout: 2000 })
    ])
    
    const chartRenderEnd = await page.evaluate(() => performance.now())
    const chartRenderTime = chartRenderEnd - chartRenderStart

    console.log(`✅ Charts render time: ${chartRenderTime.toFixed(2)}ms`)
    console.log(`   ${chartRenderTime <= 500 ? '✓' : '✗'} Target: < 500ms\n`)

    // Summary
    console.log('📊 Performance Test Summary:')
    console.log('─'.repeat(40))
    console.log(`Modal popup:    ${modalMetrics.modalAppearTime.toFixed(2)}ms ${modalMetrics.modalAppearTime <= 300 ? '✅' : '❌'} (target: 300ms)`)
    console.log(`Chart render:   ${chartRenderTime.toFixed(2)}ms ${chartRenderTime <= 500 ? '✅' : '❌'} (target: 500ms)`)
    console.log('─'.repeat(40))
    
    const allPassed = modalMetrics.modalAppearTime <= 300 && chartRenderTime <= 500
    console.log(`\n${allPassed ? '✅ All performance targets met!' : '❌ Some performance targets not met'}\n`)

  } catch (error) {
    console.error('❌ Error during performance test:', error)
  } finally {
    await browser.close()
  }
}

// Run the test
testKeywordAnalysisPerformance().catch(console.error)