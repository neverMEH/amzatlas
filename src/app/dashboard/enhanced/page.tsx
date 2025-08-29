'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/untitled-ui'
import { cn } from '@/lib/utils'

export default function EnhancedDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          Enhanced Dashboard
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Welcome to the redesigned SQP Intelligence Dashboard with modern navigation and layout.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total ASINs
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              85
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-600 dark:text-green-400">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Search Queries
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              40,731
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-600 dark:text-green-400">
              +8% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Avg. Market Share
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              24.3%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 dark:text-red-400">
              -2.1% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Revenue
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              $847K
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-600 dark:text-green-400">
              +15.3% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Layout Redesign Features</CardTitle>
            <CardDescription>
              This enhanced dashboard showcases the new UI redesign with improved navigation and space utilization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-gray-50">
                  ✅ Collapsible Sidebar Navigation
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Optimized space utilization with collapsible sidebar that expands on demand.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-gray-50">
                  ✅ Dynamic Breadcrumb Navigation
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Intelligent breadcrumb system with mobile truncation and custom routing.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-gray-50">
                  ✅ Untitled UI Components
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Modern design system with consistent styling and accessibility features.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-gray-50">
                  ✅ Responsive Design
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Mobile-first approach with optimized layouts for all screen sizes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Content Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-50">Data sync completed</p>
                <p className="text-gray-500 dark:text-gray-400">2 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-50">Brand extraction updated</p>
                <p className="text-gray-500 dark:text-gray-400">15 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <div className="flex-1 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-50">Performance report generated</p>
                <p className="text-gray-500 dark:text-gray-400">1 hour ago</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Keywords</CardTitle>
            <CardDescription>Highest conversion rates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-50">knife sharpener</span>
              <span className="text-sm text-green-600 dark:text-green-400">8.3%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-50">sharpening system</span>
              <span className="text-sm text-green-600 dark:text-green-400">7.8%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-50">work sharp</span>
              <span className="text-sm text-green-600 dark:text-green-400">7.1%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-50">electric sharpener</span>
              <span className="text-sm text-blue-600 dark:text-blue-400">6.9%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Market Insights</CardTitle>
            <CardDescription>Key trends and opportunities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                🎯 Opportunity
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Premium sharpener market showing 23% growth
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                📈 Trend
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Professional-grade tools gaining traction
              </p>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                ⚠️ Watch
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Competitor pricing changes detected
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}