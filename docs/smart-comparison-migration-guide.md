# Smart Comparison Migration Guide

## What's Changed?

The ASIN Performance Dashboard now features intelligent comparison period suggestions instead of the fixed 30-day comparison. This guide helps you understand and adapt to the new functionality.

## Before vs After

### Before (Fixed 30-Day Comparison)
- ❌ Always compared to 30 days ago
- ❌ No consideration of period type
- ❌ Often compared incompatible periods (e.g., week vs month)
- ❌ No data availability warnings

### After (Smart Comparison)
- ✅ Intelligent suggestions based on selected period
- ✅ Multiple comparison options
- ✅ Data availability indicators
- ✅ Validation and warnings

## Key Changes for Users

### 1. New Comparison Interface
When you enable comparison mode, you'll now see:
- **"Use Smart Suggestions"** button (default)
- Suggestion cards with confidence indicators
- Option to switch to manual selection

### 2. Smart Suggestions
The system now provides up to 4 intelligent suggestions:
- **Previous Period**: Compare to immediately preceding period
- **Same Period Last Month**: For weekly/daily selections
- **Same Period Last Year**: For seasonal comparisons
- **Quarter/Month Comparisons**: For longer period views

### 3. Confidence Indicators
Each suggestion shows confidence dots:
- 🟢🟢🟢 **High Confidence**: Recent data, full coverage
- 🟡🟡⚪ **Medium Confidence**: Some limitations
- 🔴⚪⚪ **Low Confidence**: Limited or old data

## How to Use

### Quick Start
1. Select your date range as normal
2. Check "Compare to another period"
3. Review the smart suggestions
4. Click on any suggestion to apply it

### For Power Users
- Press `Tab` to navigate suggestions via keyboard
- Hover over suggestions for detailed tooltips
- Switch to manual mode for custom comparisons
- Use keyboard shortcuts: `Enter` to select, `Esc` to close

## Common Scenarios

### Scenario 1: Weekly Performance Review
**Old way**: Week compared to random 30-day period
**New way**: 
- Suggestion 1: Previous Week (high confidence)
- Suggestion 2: Same Week Last Month
- Suggestion 3: Same Week Last Year

### Scenario 2: Monthly Analysis
**Old way**: Month compared to overlapping period
**New way**:
- Suggestion 1: Previous Month (high confidence)
- Suggestion 2: Same Month Last Quarter
- Suggestion 3: Same Month Last Year

### Scenario 3: Custom Date Range
**Old way**: No intelligent handling
**New way**:
- Suggestion 1: Previous N days
- Suggestion 2: Contextual suggestions based on range
- Manual selection available

## FAQ

### Q: Can I still use the old 30-day comparison?
A: Yes, switch to manual selection and choose "Custom" to set any date range.

### Q: Why don't I see "Previous Week" for my weekly selection?
A: The system validates data availability. If there's insufficient data for the previous week, it won't be suggested.

### Q: What happened to my saved comparisons?
A: The new system is more dynamic. While saved comparisons aren't available yet, the smart suggestions often provide better alternatives.

### Q: How accurate are the suggestions?
A: Suggestions are based on:
- Period type detection
- Data availability (>70% coverage required)
- Recency (newer data preferred)
- Business context (holidays, seasons)

## Tips & Tricks

### 1. Understanding Period Detection
The system automatically detects:
- **Exact periods**: 7 days = week, 30-31 days = month
- **Calendar periods**: Full months, quarters, years
- **Custom ranges**: Any other selection

### 2. Optimizing Comparisons
- Use high-confidence suggestions for accurate insights
- Consider seasonal patterns (year-over-year for holidays)
- Check data warnings before drawing conclusions

### 3. Keyboard Shortcuts
- `Tab`: Navigate through suggestions
- `Enter/Space`: Select focused suggestion
- `Esc`: Close suggestion panel
- `Arrow keys`: Navigate within date picker

## Troubleshooting

### Issue: No suggestions appearing
**Solution**: 
- Ensure date range is selected
- Check if comparison is enabled
- Verify ASIN has historical data

### Issue: Unexpected suggestions
**Solution**:
- Review the selected date range
- Check period type detection in tooltip
- Try adjusting dates by 1-2 days

### Issue: Low confidence scores
**Solution**:
- Normal for older data
- Consider shorter comparison periods
- Check data availability in tooltip

## Benefits of the New System

### 1. More Accurate Comparisons
- Period-aligned comparisons (week vs week)
- No more arbitrary 30-day windows
- Considers business cycles

### 2. Better Decision Making
- Data quality warnings
- Multiple comparison options
- Context-aware suggestions

### 3. Improved Workflow
- One-click selections
- No manual date calculations
- Intelligent defaults

## Feedback

We value your input! If you have suggestions or encounter issues:
1. Use the in-app feedback button
2. Include "Smart Comparison" in your message
3. Describe your use case and any challenges

## What's Next?

Upcoming enhancements:
- Saved comparison preferences
- Custom business periods
- Multi-period comparisons
- Machine learning improvements

Thank you for using the Smart Comparison feature!