import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const method = req.method

    // GET /project-storage - Load project data or list projects
    if (method === 'GET') {
      const projectId = url.searchParams.get('projectId')
      const listProjects = url.searchParams.get('list') === 'true'

      // If list=true, return project list
      if (listProjects) {
        console.log('📋 Loading project list...')

        // Simple user identification
        const authHeader = req.headers.get('authorization')
        const deviceId = req.headers.get('x-device-id')

        let userId = null
        let finalDeviceId = null

        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.replace('Bearer ', '')

          // Skip if it's just the anon key
          if (token !== Deno.env.get('SUPABASE_ANON_KEY')) {
            try {
              const { data: { user }, error } = await supabaseClient.auth.getUser(token)
              if (!error && user) {
                console.log('✅ Authenticated user:', user.email)
                userId = user.id
              }
            } catch (error) {
              console.log('⚠️ Token verification failed:', error.message)
            }
          }
        }

        // Fall back to device ID
        if (!userId && deviceId) {
          console.log('🔐 Using device ID:', deviceId)
          finalDeviceId = deviceId
        }

        if (!userId && !finalDeviceId) {
          return new Response(
            JSON.stringify({ success: false, error: 'No user identifier found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
          )
        }

        // Get projects
        let query = supabaseClient
          .from('projects')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(20)

        // Filter by user or device
        if (userId) {
          query = query.eq('user_id', userId)
        } else if (finalDeviceId) {
          query = query.eq('device_id', finalDeviceId)
        }

        const { data, error } = await query

        if (error) {
          console.error('❌ Database error:', error)
          return new Response(
            JSON.stringify({ success: false, error: `Failed to fetch projects: ${error.message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        console.log('📊 Found projects:', data?.length || 0)

        const projects = (data || []).map(project => ({
          id: project.id,
          name: project.name,
          description: project.description || '',
          createdAt: new Date(project.created_at).getTime(),
          updatedAt: new Date(project.updated_at).getTime(),
          panelCount: project.metadata?.panel_count || 0,
          characterCount: project.metadata?.character_count || 0,
          style: project.style,
          status: project.status || 'draft',
          imageSize: project.image_size || { width: 1024, height: 576, aspectRatio: '16:9' }
        }))

        return new Response(
          JSON.stringify({
            success: true,
            projects,
            meta: {
              pagination: {
                page: 1,
                limit: 20,
                total: projects.length,
                totalPages: Math.ceil(projects.length / 20)
              }
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      // Original single project loading logic
      if (!projectId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project ID is required for single project loading' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log(`📂 Loading project data for: ${projectId}`)

      // Get project data from database
      const { data: project, error: projectError } = await supabaseClient
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectError || !project) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      // Return basic project data structure expected by frontend
      const projectData = {
        story: project.story || '',
        style: project.style || 'manga',
        storyAnalysis: null,
        storyBreakdown: null,
        characterReferences: [],
        generatedPanels: [],
        uploadedCharacterReferences: [],
        uploadedSettingReferences: [],
        imageSize: project.image_size || { width: 1024, height: 576, aspectRatio: '16:9' },
        generationState: project.generation_state || null,
        aiModel: project.ai_model || 'auto',
        setting: null,
        scenes: []
      }

      console.log('✅ Project data loaded successfully')

      return new Response(
        JSON.stringify({ success: true, data: projectData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // POST /project-storage - Save project data
    if (method === 'POST') {
      console.log('💾 Saving project data...')
      
      const body = await req.json()
      const { projectId, story, metadata } = body

      if (!projectId || !story) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project ID and story are required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Update basic project data in database
      const updateData: any = {
        story: story,
        updated_at: new Date().toISOString()
      }

      // Add metadata fields if provided
      if (metadata) {
        if (metadata.style) updateData.style = metadata.style
        if (metadata.imageSize) updateData.image_size = metadata.imageSize
        if (metadata.generationState) updateData.generation_state = metadata.generationState
        if (metadata.aiModel) updateData.ai_model = metadata.aiModel
      }

      const { error: updateError } = await supabaseClient
        .from('projects')
        .update(updateData)
        .eq('id', projectId)

      if (updateError) {
        console.error('❌ Failed to update project:', updateError)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to save project data' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      console.log('✅ Project data saved successfully')

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )

  } catch (error) {
    console.error('❌ Edge function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
