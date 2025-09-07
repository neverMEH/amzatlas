# SQP Intelligence Deployment Guide

## Environment Variables

The application requires the following environment variables to be set in your Railway deployment:

### Required Variables

1. **SUPABASE_URL** or **NEXT_PUBLIC_SUPABASE_URL**
   - Your Supabase project URL
   - Example: `https://your-project.supabase.co`

2. **SUPABASE_ANON_KEY** or **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Your Supabase anonymous/public key
   - Found in your Supabase project settings

3. **SUPABASE_SERVICE_ROLE_KEY** (Optional but recommended)
   - Your Supabase service role key for server-side operations
   - Provides full database access for API routes

### BigQuery Variables (if using data sync)

4. **BIGQUERY_PROJECT_ID**
   - Your Google Cloud project ID

5. **BIGQUERY_DATASET**
   - The BigQuery dataset name (e.g., `dataclient_amzatlas_agency_85`)

6. **GOOGLE_APPLICATION_CREDENTIALS_JSON**
   - Your service account credentials as a JSON string

### Email Configuration (optional)

7. **SENDGRID_API_KEY** (for SendGrid)
   - Your SendGrid API key for email delivery

Or for SMTP:

8. **SMTP_HOST**
9. **SMTP_PORT**
10. **SMTP_USER**
11. **SMTP_PASS**

## Railway Deployment Steps

1. **Set Environment Variables in Railway Dashboard**
   - Go to your Railway project
   - Click on the service
   - Navigate to "Variables" tab
   - Add each required variable

2. **Variable Naming on Railway**
   Railway may handle environment variables differently. The application checks for multiple naming patterns:
   - Standard: `SUPABASE_URL`
   - Next.js public: `NEXT_PUBLIC_SUPABASE_URL`
   - Railway public: `RAILWAY_PUBLIC_SUPABASE_URL`

3. **Verify Deployment**
   After deployment, check the environment health endpoint:
   ```
   https://your-app.railway.app/api/health/env
   ```

   This endpoint will show:
   - Which environment variables are detected
   - Configuration validation status
   - Recommendations for missing variables

## Troubleshooting

### "Missing Supabase environment variables" Error

1. Check the health endpoint: `/api/health/env`
2. Ensure variables are set in Railway's Variables tab
3. Try different naming patterns if standard names don't work
4. Redeploy after setting variables

### Build vs Runtime Variables

- The application uses placeholder values during build time
- Actual environment variables are loaded at runtime
- This prevents build failures due to missing secrets

### Debug Mode

To see which environment variables are being detected:
1. Check the response headers of any API call for `X-Env-Check`
2. Use the `/api/health/env` endpoint
3. Check Railway deployment logs

## Security Notes

- Never commit environment variables to the repository
- Use Railway's built-in variable management
- Service role keys should only be set as server-side variables
- Public/anon keys can be exposed to the client safely