import React, { useEffect, useState, useRef } from 'react';
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
export const DateRangeSelector = ({
  onComparisonChange
}) => {
  // State for time period selection
  const [periodType, setPeriodType] = useState('month');
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  // State for comparison
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonType, setComparisonType] = useState('previous_period');
  // State for custom date selection
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [customDateRange, setCustomDateRange] = useState(false);
  // Refs for click outside
  const periodDropdownRef = useRef(null);
  const comparisonDropdownRef = useRef(null);
  // Notify parent when comparison state changes
  useEffect(() => {
    if (onComparisonChange) {
      onComparisonChange(showComparison);
    }
  }, [showComparison, onComparisonChange]);
  // Period options based on selected type
  const getPeriodOptions = () => {
    switch (periodType) {
      case 'week':
        return ['This Week', 'Last Week', 'Week of Jun 10', 'Week of Jun 3', 'Week of May 27', 'Custom Range'];
      case 'month':
        return ['This Month', 'Last Month', 'May 2023', 'April 2023', 'March 2023', 'Custom Range'];
      case 'quarter':
        return ['This Quarter', 'Last Quarter', 'Q1 2023', 'Q4 2022', 'Q3 2022', 'Custom Range'];
      case 'year':
        return ['This Year', 'Last Year', '2022', '2021', '2020', 'Custom Range'];
      default:
        return ['This Month', 'Last Month', 'Custom Range'];
    }
  };
  // Get formatted date range text
  const getDateRangeText = () => {
    if (customDateRange && startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    const now = new Date();
    switch (selectedPeriod) {
      case 'This Week':
        return 'Jun 17 - Jun 23, 2023';
      case 'Last Week':
        return 'Jun 10 - Jun 16, 2023';
      case 'This Month':
        return 'Jun 1 - Jun 30, 2023';
      case 'Last Month':
        return 'May 1 - May 31, 2023';
      case 'This Quarter':
        return 'Apr 1 - Jun 30, 2023';
      case 'Last Quarter':
        return 'Jan 1 - Mar 31, 2023';
      case 'This Year':
        return 'Jan 1 - Dec 31, 2023';
      case 'Last Year':
        return 'Jan 1 - Dec 31, 2022';
      default:
        return 'Jun 1 - Jun 30, 2023';
    }
  };
  // Get comparison text
  const getComparisonText = () => {
    if (comparisonType === 'previous_period') {
      switch (selectedPeriod) {
        case 'This Week':
          return 'vs Jun 10 - Jun 16, 2023';
        case 'Last Week':
          return 'vs Jun 3 - Jun 9, 2023';
        case 'This Month':
          return 'vs May 1 - May 31, 2023';
        case 'Last Month':
          return 'vs Apr 1 - Apr 30, 2023';
        case 'This Quarter':
          return 'vs Jan 1 - Mar 31, 2023';
        case 'Last Quarter':
          return 'vs Oct 1 - Dec 31, 2022';
        case 'This Year':
          return 'vs Jan 1 - Dec 31, 2022';
        case 'Last Year':
          return 'vs Jan 1 - Dec 31, 2021';
        default:
          return 'vs Previous Period';
      }
    } else {
      // Previous year comparison
      switch (selectedPeriod) {
        case 'This Week':
          return 'vs Jun 18 - Jun 24, 2022';
        case 'Last Week':
          return 'vs Jun 11 - Jun 17, 2022';
        case 'This Month':
          return 'vs Jun 1 - Jun 30, 2022';
        case 'Last Month':
          return 'vs May 1 - May 31, 2022';
        case 'This Quarter':
          return 'vs Apr 1 - Jun 30, 2022';
        case 'Last Quarter':
          return 'vs Jan 1 - Mar 31, 2022';
        case 'This Year':
          return 'vs Jan 1 - Dec 31, 2022';
        case 'Last Year':
          return 'vs Jan 1 - Dec 31, 2021';
        default:
          return 'vs Same Period Last Year';
      }
    }
  };
  // Toggle period dropdown
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const [isComparisonDropdownOpen, setIsComparisonDropdownOpen] = useState(false);
  // Calendar helper functions
  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };
  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };
  const formatDate = date => {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };
  // Get start and end dates based on period type and selected date
  const getPeriodDates = date => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    let start, end;
    switch (periodType) {
      case 'week':
        // Get the start of the week (Sunday)
        const dayOfWeek = date.getDay();
        start = new Date(year, month, day - dayOfWeek);
        end = new Date(year, month, day + (6 - dayOfWeek));
        break;
      case 'month':
        // Get first and last day of the month
        start = new Date(year, month, 1);
        end = new Date(year, month + 1, 0);
        break;
      case 'quarter':
        // Get the quarter for the selected date
        const quarter = Math.floor(month / 3);
        start = new Date(year, quarter * 3, 1);
        end = new Date(year, (quarter + 1) * 3, 0);
        break;
      case 'year':
        // Get the full year
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31);
        break;
      default:
        // Default to month
        start = new Date(year, month, 1);
        end = new Date(year, month + 1, 0);
    }
    return {
      start,
      end
    };
  };
  const handleDateClick = day => {
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    // Get period start and end based on clicked date and period type
    const {
      start,
      end
    } = getPeriodDates(clickedDate);
    setStartDate(start);
    setEndDate(end);
    setCustomDateRange(true);
    setSelectedPeriod('Custom Range');
    setIsPeriodDropdownOpen(false);
  };
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  // Get period name for display in the calendar
  const getPeriodName = date => {
    const {
      start,
      end
    } = getPeriodDates(date);
    switch (periodType) {
      case 'week':
        return `Week of ${formatDate(start).split(',')[0]}`;
      case 'month':
        return start.toLocaleString('default', {
          month: 'long',
          year: 'numeric'
        });
      case 'quarter':
        const quarter = Math.floor(start.getMonth() / 3) + 1;
        return `Q${quarter} ${start.getFullYear()}`;
      case 'year':
        return start.getFullYear().toString();
      default:
        return start.toLocaleString('default', {
          month: 'long',
          year: 'numeric'
        });
    }
  };
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth.getMonth(), currentMonth.getFullYear());
    const firstDay = getFirstDayOfMonth(currentMonth.getMonth(), currentMonth.getFullYear());
    const days = [];
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    // Add day names
    dayNames.forEach((day, index) => {
      days.push(<div key={`header-${index}`} className="w-10 h-10 flex items-center justify-center text-xs font-medium text-gray-500">
          {day}
        </div>);
    });
    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-10 h-10"></div>);
    }
    // Add days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      // Get period for this date
      const {
        start,
        end
      } = getPeriodDates(date);
      // Check if this day is in the selected period
      const isSelected = startDate && endDate && date >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) && date <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      // Check if this day is the first day of a period
      const isFirstDayOfPeriod = date.getDate() === start.getDate() && date.getMonth() === start.getMonth() && date.getFullYear() === start.getFullYear();
      let className = 'w-10 h-10 flex items-center justify-center text-sm rounded-md cursor-pointer ';
      if (isSelected) {
        className += 'bg-blue-100 text-blue-800 ';
        if (isFirstDayOfPeriod) {
          className += 'border-l-2 border-t-2 border-b-2 border-blue-600 ';
        } else if (date.getDate() === end.getDate()) {
          className += 'border-r-2 border-t-2 border-b-2 border-blue-600 ';
        }
      } else {
        className += 'hover:bg-gray-100 ';
      }
      // Add period indicator for first day of period
      const showPeriodIndicator = isFirstDayOfPeriod && periodType !== 'day';
      days.push(<div key={`day-${day}`} className={className} onClick={() => handleDateClick(day)} title={getPeriodName(date)}>
          <div className="relative">
            {day}
            {showPeriodIndicator && <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full"></div>}
          </div>
        </div>);
    }
    return <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium">
            {currentMonth.toLocaleString('default', {
            month: 'long',
            year: 'numeric'
          })}
          </div>
          <div className="flex space-x-2">
            <button className="p-1 rounded-full hover:bg-gray-100" onClick={handlePrevMonth}>
              <ChevronLeftIcon size={16} />
            </button>
            <button className="p-1 rounded-full hover:bg-gray-100" onClick={handleNextMonth}>
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">{days}</div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Select a {periodType} to apply
          </div>
          <div className="text-xs">
            {startDate && endDate && <span>
                {formatDate(startDate)} - {formatDate(endDate)}
              </span>}
          </div>
        </div>
        {startDate && endDate && <button className="mt-4 w-full py-2 bg-blue-600 text-white rounded-md text-sm font-medium" onClick={() => {
        setCustomDateRange(true);
        setSelectedPeriod('Custom Range');
        setIsPeriodDropdownOpen(false);
      }}>
            Apply {periodType.charAt(0).toUpperCase() + periodType.slice(1)}
          </button>}
        <button className="mt-2 w-full py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium" onClick={() => {
        setStartDate(null);
        setEndDate(null);
      }}>
          Reset
        </button>
      </div>;
  };
  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = event => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target) && !event.target.closest('.period-selector-button')) {
        setIsPeriodDropdownOpen(false);
      }
      if (comparisonDropdownRef.current && !comparisonDropdownRef.current.contains(event.target) && !event.target.closest('.comparison-selector-button')) {
        setIsComparisonDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  // Reset date selection when changing period type
  useEffect(() => {
    setCustomDateRange(false);
    setStartDate(null);
    setEndDate(null);
  }, [periodType]);
  return <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          {/* Period Type Selector and Period Selector grouped together */}
          <div className="flex items-center space-x-4">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-md">
              {['week', 'month', 'quarter', 'year'].map(type => <button key={type} className={`px-4 py-1.5 text-sm font-medium rounded-md ${periodType === type ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => {
              setPeriodType(type);
              setSelectedPeriod(`This ${type.charAt(0).toUpperCase() + type.slice(1)}`);
            }}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>)}
            </div>
            {/* Period Selector with Calendar */}
            <div className="relative">
              <div className="period-selector-button flex items-center space-x-2 px-4 py-2 rounded-md border border-gray-200 cursor-pointer" onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}>
                <CalendarIcon size={16} className="text-gray-400" />
                <span className="text-sm font-medium">{selectedPeriod}</span>
                <ChevronDownIcon size={16} />
              </div>
              {isPeriodDropdownOpen && <div ref={periodDropdownRef} className="absolute mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="flex">
                    {/* Predefined periods list */}
                    <div className="w-48 border-r border-gray-200">
                      <ul className="py-1">
                        {getPeriodOptions().map((period, index) => <li key={index} className={`px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm ${period === selectedPeriod ? 'bg-blue-50 text-blue-700 font-medium' : ''}`} onClick={() => {
                      if (period === 'Custom Range') {
                        // Just show the calendar, don't close dropdown
                        setCustomDateRange(true);
                      } else {
                        setSelectedPeriod(period);
                        setCustomDateRange(false);
                        setIsPeriodDropdownOpen(false);
                      }
                    }}>
                            {period}
                          </li>)}
                      </ul>
                    </div>
                    {/* Calendar */}
                    <div className="w-72">{renderCalendar()}</div>
                  </div>
                </div>}
            </div>
          </div>
          {/* Date range text */}
          <div className="text-sm text-gray-500">{getDateRangeText()}</div>
        </div>
        {/* Comparison Selector - Fixed on right with slide-out options */}
        <div className="relative flex items-center justify-end">
          {/* Comparison options that slide out from the left */}
          <div className={`absolute right-full mr-3 transition-all duration-300 ease-in-out flex items-center space-x-3 ${showComparison ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'}`}>
            <div className="relative">
              <div className="comparison-selector-button flex items-center space-x-2 px-4 py-2 rounded-md border border-gray-200 cursor-pointer whitespace-nowrap" onClick={() => setIsComparisonDropdownOpen(!isComparisonDropdownOpen)}>
                <span className="text-sm font-medium">
                  {comparisonType === 'previous_period' ? 'Previous Period' : 'Previous Year'}
                </span>
                <ChevronDownIcon size={16} />
              </div>
              {isComparisonDropdownOpen && <div ref={comparisonDropdownRef} className="absolute mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <ul className="py-1">
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm" onClick={() => {
                  setComparisonType('previous_period');
                  setIsComparisonDropdownOpen(false);
                }}>
                      Previous Period
                    </li>
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm" onClick={() => {
                  setComparisonType('previous_year');
                  setIsComparisonDropdownOpen(false);
                }}>
                      Previous Year
                    </li>
                  </ul>
                </div>}
            </div>
            <div className="text-sm text-gray-500 whitespace-nowrap">
              {getComparisonText()}
            </div>
          </div>
          {/* Compare checkbox - always fixed on the right */}
          <div className="flex items-center bg-gray-100 px-3 py-1.5 rounded-md">
            <input type="checkbox" id="compare" checked={showComparison} onChange={() => setShowComparison(!showComparison)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="compare" className="ml-2 text-sm font-medium text-gray-600">
              Compare
            </label>
          </div>
        </div>
      </div>
    </div>;
};