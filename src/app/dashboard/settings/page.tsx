export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-display-xs font-semibold text-gray-900 dark:text-gray-50">
        Settings
      </h1>
      <p className="mt-2 text-md text-gray-600 dark:text-gray-400">
        Configure your dashboard preferences and data refresh settings
      </p>
      
      <div className="mt-8 space-y-6">
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
              Data Refresh
            </h3>
          </div>
          <div className="px-6 py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure how often your data should be refreshed from BigQuery
            </p>
            <div className="mt-4">
              <label htmlFor="refresh-interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Refresh Interval
              </label>
              <select
                id="refresh-interval"
                className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option>Every 24 hours (Daily)</option>
                <option>Every 12 hours</option>
                <option>Every 6 hours</option>
                <option>Every hour</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
              Display Preferences
            </h3>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Dark Mode
                </label>
                <button className="text-sm text-primary-600 dark:text-primary-400">
                  Toggle in header
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Compact View
                </label>
                <input type="checkbox" className="rounded border-gray-300 dark:border-gray-700" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}