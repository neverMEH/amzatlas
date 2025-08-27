export default function Home() {
  return (
    <main className="container mx-auto p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">SQP Intelligence Platform</h1>
        <p className="text-xl text-gray-600 mb-8">
          AI-powered analytics platform for Amazon sellers and agencies
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Pipeline Monitoring</h2>
            <p className="text-gray-600 mb-4">
              Monitor your BigQuery SQP data pipeline health, metrics, and performance.
            </p>
            <a 
              href="/api/monitoring/pipeline" 
              className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              View Pipeline Status
            </a>
          </div>
          
          <div className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Health Check</h2>
            <p className="text-gray-600 mb-4">
              Check the current health status of your data pipeline.
            </p>
            <a 
              href="/api/health/pipeline" 
              className="inline-block bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Health Status
            </a>
          </div>
        </div>
        
        <div className="mt-12">
          <h3 className="text-lg font-semibold mb-4">Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-gray-50 rounded">
              <strong>Search Performance Data</strong><br/>
              Access real Amazon purchase behavior data
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <strong>AI Analysis</strong><br/>
              Transform weeks of reporting into seconds of insights
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <strong>Accurate ROI</strong><br/>
              90% more accurate keyword ROI calculations
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}