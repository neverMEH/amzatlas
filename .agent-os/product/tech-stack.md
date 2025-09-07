# Technical Stack

## Frontend Architecture
- **Application Framework**: Next.js 14.0.0
- **JavaScript Framework**: React 18 with TypeScript 5
- **CSS Framework**: TailwindCSS 3.4.17
- **UI Component Library**: Custom components with Radix UI primitives (@radix-ui/react-tooltip)
- **Charts & Visualization**: Recharts 3.1.2
- **State Management**: React Query (@tanstack/react-query) 5.85.5
- **Icons**: Lucide React 0.542.0
- **Import Strategy**: Node.js modules with TypeScript path aliases

## Backend Architecture
- **Runtime**: Node.js 20+ (engines requirement)
- **API Framework**: Next.js App Router API routes with versioned endpoints (v1/v2)
- **Database System**: PostgreSQL (Supabase managed)
- **ORM**: Supabase client with custom SQL views and materialized tables
- **Data Source**: Google BigQuery 8.1.1 with connection pooling
- **Background Processing**: Custom ETL pipeline with batch processing

## Data & Storage
- **Primary Database**: Supabase PostgreSQL with custom `sqp` schema
- **Database Hosting**: Supabase managed PostgreSQL
- **Data Pipeline**: BigQuery → Supabase sync with 204k+ records
- **File Processing**: CSV/Excel/PDF export with jspdf and xlsx libraries
- **Caching Strategy**: LRU caching for date calculations (200x performance improvement)

## Development & Testing
- **Language**: TypeScript 5 throughout entire stack
- **Testing Framework**: Vitest 3.2.4 with jsdom
- **Testing Library**: React Testing Library 16.3.0
- **Build Tool**: Next.js built-in bundler with PostCSS
- **Package Manager**: npm
- **Development Tools**: tsx for TypeScript execution

## Deployment & Infrastructure
- **Application Hosting**: Railway with automated deployments
- **Database Hosting**: Supabase managed PostgreSQL
- **Edge Functions**: 7 Supabase Edge Functions for data processing
- **Domain & CDN**: Railway managed
- **Environment Management**: Dotenv with Railway environment variables
- **Monitoring**: Custom pipeline health checks and BigQuery monitoring

## External Services Integration
- **BigQuery**: Google Cloud BigQuery 8.1.1 for data source
- **Email Services**: SendGrid 8.1.5 for report delivery
- **Logging**: Google Cloud Logging 11.2.0
- **Cron Processing**: node-cron 4.2.1 for scheduled tasks
- **Date Processing**: date-fns 4.1.0 with timezone support

## Code Repository
- **Version Control**: Git
- **Repository URL**: /mnt/c/Users/Aeciu/Dev Work/amzatlas (local development)
- **Deployment Branch**: main branch auto-deploys to production
- **Migration System**: Custom migration runner with 47+ database migrations