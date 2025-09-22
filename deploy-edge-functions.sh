#!/bin/bash

# Deploy Supabase Edge Functions for Story to Manga
# Make sure you have Supabase CLI installed and logged in

set -e

echo "🚀 Deploying Supabase Edge Functions..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please login first:"
    echo "   supabase login"
    exit 1
fi

# Set your Supabase project reference
# Replace with your actual project reference
if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo "❌ Please set SUPABASE_PROJECT_REF environment variable"
    echo "   export SUPABASE_PROJECT_REF=your-project-ref"
    exit 1
fi

PROJECT_REF="$SUPABASE_PROJECT_REF"

echo "📋 Using project reference: $PROJECT_REF"

# Deploy projects function
echo "📦 Deploying projects function..."
supabase functions deploy projects --project-ref $PROJECT_REF

# Deploy project-storage function
echo "📦 Deploying project-storage function..."
supabase functions deploy project-storage --project-ref $PROJECT_REF

echo "✅ Edge Functions deployed successfully!"

echo ""
echo "🔧 Next steps:"
echo "1. Update your frontend to use the new Edge Function URLs:"
echo "   - Projects API: https://$PROJECT_REF.supabase.co/functions/v1/projects"
echo "   - Storage API: https://$PROJECT_REF.supabase.co/functions/v1/project-storage"
echo ""
echo "2. Make sure your environment variables are set in Supabase:"
echo "   - R2_ENDPOINT"
echo "   - R2_ACCESS_KEY_ID" 
echo "   - R2_SECRET_ACCESS_KEY"
echo "   - R2_BUCKET_NAME"
echo ""
echo "3. Create the database tables by running the SQL in database/create_projects_table.sql"
