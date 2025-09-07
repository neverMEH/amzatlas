# Spec Requirements Document

> Spec: Dynamic Popup Keyword Window
> Created: 2025-08-31

## Overview

Enhance the existing KeywordAnalysisModal to dynamically adapt its content based on window size, prioritizing sparkline charts in the popup view while reserving complex visualizations for the full-page experience. This feature will improve usability by ensuring charts remain readable in the constrained popup space.

## User Stories

### Optimized Popup View

As a user analyzing keyword performance, I want to see clear, concise sparkline visualizations in the popup modal, so that I can quickly understand trends without visual clutter.

The user clicks on a keyword in the SearchQueryTable, triggering the modal popup. Instead of seeing cramped full-sized charts, they see elegant sparkline bar or line charts that convey key performance trends at a glance. The interface clearly indicates that more detailed analysis is available in the full-page view.

### Progressive Information Disclosure

As a power user, I want to access detailed visualizations when needed, so that I can perform in-depth analysis without compromising the quick-view experience.

When the user needs more detail, they click the expand button to navigate to the full keyword analysis page where comprehensive charts, funnels, and market share visualizations are displayed with ample space for clarity.

## Spec Scope

1. **Dynamic Content Rendering** - Detect modal size and render appropriate chart types (sparklines for popup, full charts for expanded view)
2. **Sparkline Chart Components** - Create lightweight bar/line chart components optimized for small spaces
3. **Content Priority System** - Show only essential metrics in popup view (impressions, clicks, purchases trends)
4. **Visual Hierarchy** - Clear indication that popup is a preview with option to see full analysis
5. **Smooth Transitions** - Maintain context when transitioning from popup to full page

## Out of Scope

- Changing the existing modal trigger mechanism
- Modifying the full-page keyword analysis route
- Altering date range or comparison period inheritance
- Changing responsive behavior outside of chart content
- Adding new data or API endpoints

## Expected Deliverable

1. Popup modal displays clean sparkline charts that are easily readable in the constrained space
2. Clear visual indication that more detailed analysis is available via the expand button
3. Seamless transition from popup preview to full-page detailed view maintaining all context