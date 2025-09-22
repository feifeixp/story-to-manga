import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface ProjectData {
  projectId: string
  story: string
  style: string
  storyAnalysis?: any
  storyBreakdown?: any
  characterReferences?: any[]
  generatedPanels?: any[]
  uploadedCharacterReferences?: any[]
  uploadedSettingReferences?: any[]
  imageSize?: any
  generationState?: any
  aiModel?: string
  setting?: any
  scenes?: any[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Initialize R2 client (if needed)
    const R2_ENDPOINT = Deno.env.get('R2_ENDPOINT')
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')
    const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME')

    const url = new URL(req.url)
    const method = req.method

    // Get user identifier
    const getUserIdentifier = async () => {
      const authHeader = req.headers.get('authorization')
      const deviceId = req.headers.get('x-device-id')

      if (authHeader?.startsWith('Bearer ')) {
        const { data: { user } } = await supabaseClient.auth.getUser()
        if (user) {
          return { userId: user.id, deviceId: null }
        }
      }

      if (deviceId) {
        return { userId: null, deviceId }
      }

      throw new Error('No user identifier found')
    }

    // POST /project-storage - Save project data
    if (method === 'POST') {
      console.log('💾 Saving project data...')
      
      const body = await req.json()
      const projectData: ProjectData = body

      if (!projectData.projectId || !projectData.story) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project ID and story are required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }

      const { userId, deviceId } = await getUserIdentifier()

      // Verify project ownership
      let projectQuery = supabaseClient
        .from('projects')
        .select('id, r2_path')
        .eq('id', projectData.projectId)

      if (userId) {
        projectQuery = projectQuery.eq('user_id', userId)
      } else if (deviceId) {
        projectQuery = projectQuery.eq('device_id', deviceId)
      }

      const { data: project, error: projectError } = await projectQuery.single()

      if (projectError || !project) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project not found or access denied' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        )
      }

      // Save data to R2 if configured
      if (R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
        try {
          const r2Path = `${project.r2_path}/project-data.json`
          
          // Create AWS S3 compatible client for R2
          const encoder = new TextEncoder()
          const dataToSave = JSON.stringify(projectData, null, 2)
          const dataBuffer = encoder.encode(dataToSave)

          // For now, we'll store in Supabase Storage as a fallback
          // TODO: Implement direct R2 upload using AWS SDK
          console.log('📁 Saving to R2 path:', r2Path)
          
          // Store metadata in project_files table
          const { error: fileError } = await supabaseClient
            .from('project_files')
            .upsert({
              project_id: projectData.projectId,
              file_type: 'project_data',
              file_path: r2Path,
              file_size: dataBuffer.length,
              content_type: 'application/json',
              metadata: {
                story_length: projectData.story?.length || 0,
                panel_count: projectData.generatedPanels?.length || 0,
                character_count: projectData.characterReferences?.length || 0,
                last_updated: new Date().toISOString()
              }
            }, {
              onConflict: 'project_id,file_type,file_path'
            })

          if (fileError) {
            console.error('❌ Failed to save file metadata:', fileError)
          }

        } catch (r2Error) {
          console.error('❌ R2 storage error:', r2Error)
          // Continue with database storage as fallback
        }
      }

      // Update project metadata
      const { error: updateError } = await supabaseClient
        .from('projects')
        .update({
          story: projectData.story,
          style: projectData.style,
          ai_model: projectData.aiModel || 'auto',
          image_size: projectData.imageSize,
          generation_state: projectData.generationState,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectData.projectId)

      if (updateError) {
        console.error('❌ Failed to update project:', updateError)
        throw new Error(`Failed to update project: ${updateError.message}`)
      }

      console.log('✅ Project data saved successfully')

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Project data saved successfully'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // GET /project-storage - Load project data
    if (method === 'GET') {
      console.log('📂 Loading project data...')
      
      const projectId = url.searchParams.get('projectId')

      if (!projectId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project ID is required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }

      const { userId, deviceId } = await getUserIdentifier()

      // Verify project ownership and get project data
      let projectQuery = supabaseClient
        .from('projects')
        .select('*')
        .eq('id', projectId)

      if (userId) {
        projectQuery = projectQuery.eq('user_id', userId)
      } else if (deviceId) {
        projectQuery = projectQuery.eq('device_id', deviceId)
      }

      const { data: project, error: projectError } = await projectQuery.single()

      if (projectError || !project) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project not found or access denied' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        )
      }

      // Try to load from R2 first, then fallback to database
      let projectData: any = {
        story: project.story,
        style: project.style,
        storyAnalysis: null,
        storyBreakdown: null,
        characterReferences: [],
        generatedPanels: [],
        uploadedCharacterReferences: [],
        uploadedSettingReferences: [],
        imageSize: project.image_size || { width: 1024, height: 576, aspectRatio: '16:9' },
        generationState: project.generation_state,
        aiModel: project.ai_model || 'auto',
        setting: null,
        scenes: []
      }

      // TODO: Load additional data from R2 if available
      // For now, return basic project data from database

      console.log('✅ Project data loaded successfully')

      return new Response(
        JSON.stringify({
          success: true,
          data: projectData
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )

  } catch (error) {
    console.error('❌ Edge function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
