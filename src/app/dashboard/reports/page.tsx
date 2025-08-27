export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-display-xs font-semibold text-gray-900 dark:text-gray-50">
        Reports
      </h1>
      <p className="mt-2 text-md text-gray-600 dark:text-gray-400">
        Select a report category from the sidebar to view detailed analytics
      </p>
      
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {[
          { name: 'Performance', description: 'Core performance metrics and KPIs' },
          { name: 'Growth & Trends', description: 'Trend analysis and growth patterns' },
          { name: 'ROI & Investment', description: 'Return on investment analysis' },
          { name: 'Strategic Actions', description: 'Actionable insights and recommendations' },
        ].map((category) => (
          <div
            key={category.name}
            className="relative rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
              {category.name}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {category.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}