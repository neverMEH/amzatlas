# Search Query Weekly Chart Feature Specification

## Overview
When the date range selection is exactly one week (7 days), display bar charts or pie charts instead of line sparklines in the search query performance popup.

## Problem
Currently, the MetricSparkline component always displays line charts regardless of the date range. For weekly date ranges, bar charts or pie charts would provide better visualization for the limited data points.

## Solution
Detect when the date range is exactly 7 days and automatically switch the chart type from line to bar (or optionally pie) for better visual representation.

## Technical Requirements
1. Detect weekly date range in KeywordAnalysisModal
2. Pass appropriate chartType to MetricSparkline based on date range
3. Ensure bar charts render properly with 7 data points
4. Maintain existing functionality for non-weekly date ranges

## Affected Components
- KeywordAnalysisModal
- MetricSparkline 
- SparklineChart