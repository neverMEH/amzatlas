# Technical Stack

## Application Architecture

- **Application Framework:** Next.js 14 with App Router
- **Database System:** BigQuery (primary data warehouse) + Supabase (application data)
- **JavaScript Framework:** React 18 with TypeScript
- **Import Strategy:** Node modules with ES6 imports
- **CSS Framework:** Tailwind CSS v3.4
- **UI Component Library:** shadcn/ui with Radix UI primitives
- **Fonts Provider:** Google Fonts (Inter)
- **Icon Library:** Lucide Icons

## AI & Analytics Stack

- **LLM Orchestration:** LangChain for tool coordination
- **Primary AI Model:** OpenAI GPT-4 for analysis
- **Secondary AI Model:** Claude 3 for report writing
- **Vector Database:** Pinecone for context retention
- **ML Framework:** Python FastAPI service for ML processing

## Data Visualization

- **Charting Library:** Recharts for dynamic visualizations
- **Data Processing:** Apache Arrow for efficient data handling
- **Real-time Updates:** Server-Sent Events (SSE)

## Infrastructure & Hosting

- **Application Hosting:** Railway (Next.js app + FastAPI service)
- **Database Hosting:** Google Cloud (BigQuery) + Supabase Cloud
- **Asset Hosting:** Vercel Edge Network (via Next.js)
- **Deployment Solution:** Railway with GitHub integration
- **Code Repository URL:** https://github.com/yourusername/sqp-intelligence

## Additional Services

- **Authentication:** Supabase Auth with Row Level Security
- **Caching Layer:** Redis on Railway
- **Job Queue:** BullMQ with Redis backend
- **Monitoring:** Railway metrics + Google Cloud Logging
- **Email Service:** Resend for transactional emails
- **File Storage:** Supabase Storage for report exports

## Development Tools

- **Package Manager:** pnpm
- **Code Quality:** ESLint + Prettier + Husky
- **Testing Framework:** Vitest + React Testing Library
- **API Testing:** Playwright for E2E tests
- **Type Safety:** TypeScript strict mode + Zod validation