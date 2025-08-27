export default function CustomViewsPage() {
  return (
    <div>
      <h1 className="text-display-xs font-semibold text-gray-900 dark:text-gray-50">
        Custom Views
      </h1>
      <p className="mt-2 text-md text-gray-600 dark:text-gray-400">
        Create and manage custom dashboard views with personalized filters and layouts
      </p>
      
      <div className="mt-8">
        <button className="inline-flex items-center gap-x-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New View
        </button>
      </div>
      
      <div className="mt-8 text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-800">
        <p className="text-gray-500 dark:text-gray-400">
          No custom views created yet. Create your first view to get started.
        </p>
      </div>
    </div>
  )
}