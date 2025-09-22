import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface GenerationJob {
  id: string
  project_id: string
  type: 'story_analysis' | 'character_generation' | 'panel_generation' | 'batch_generation'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  input_data: any
  result_data?: any
  error_message?: string
  created_at: string
  updated_at: string
  completed_at?: string
}

interface StoryAnalysisRequest {
  projectId: string
  story: string
  style: string
  language?: string
}

interface GenerateCharacterRequest {
  projectId: string
  characterName: string
  description: string
  style: string
  referenceImages?: string[]
}

interface GeneratePanelRequest {
  projectId: string
  sceneIndex: number
  sceneDescription: string
  characters: any[]
  style: string
  imageSize?: any
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

    const url = new URL(req.url)
    const method = req.method
    const pathSegments = url.pathname.split('/').filter(Boolean)

    // Extract action and parameters from path
    // For /functions/v1/manga-generation/jobs/job-id -> ['functions', 'v1', 'manga-generation', 'jobs', 'job-id']
    const functionIndex = pathSegments.indexOf('manga-generation')
    const actionSegments = pathSegments.slice(functionIndex + 1)
    const action = actionSegments.join('/')

    console.log('🎨 Manga Generation API:', { method, action, pathSegments: actionSegments })

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



    // Create generation job
    const createGenerationJob = async (
      projectId: string,
      type: string,
      inputData: any,
      userId?: string,
      deviceId?: string
    ): Promise<GenerationJob> => {
      const now = new Date().toISOString()

      const jobData = {
        // Let database generate UUID automatically (remove id field)
        project_id: projectId,
        type,
        status: 'pending',
        progress: 0,
        input_data: inputData,
        user_id: userId,
        device_id: deviceId,
        created_at: now,
        updated_at: now,
      }

      const { data, error } = await supabaseClient
        .from('generation_jobs')
        .insert([jobData])
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to create generation job: ${error.message}`)
      }

      return data
    }

    // Update generation job
    const updateGenerationJob = async (
      jobId: string,
      updates: Partial<GenerationJob>
    ): Promise<void> => {
      const { error } = await supabaseClient
        .from('generation_jobs')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (error) {
        throw new Error(`Failed to update generation job: ${error.message}`)
      }
    }

    // Mock AI service calls (replace with actual AI integration)
    const callAIService = async (type: string, data: any): Promise<any> => {
      console.log(`🤖 Calling AI service for ${type}:`, data)
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      switch (type) {
        case 'story_analysis':
          return {
            setting: '现代都市',
            characters: [
              { name: '小明', description: '主角，年轻的程序员' },
              { name: '小红', description: '女主角，设计师' }
            ],
            scenes: [
              { description: '小明在咖啡厅工作', location: '咖啡厅' },
              { description: '遇见小红', location: '咖啡厅' },
              { description: '一起讨论项目', location: '办公室' }
            ],
            mood: 'romantic',
            genre: 'slice_of_life'
          }
        
        case 'character_generation':
          return {
            imageUrl: 'https://example.com/character.jpg',
            description: '生成的角色图片',
            features: ['黑发', '大眼睛', '微笑']
          }
        
        case 'panel_generation':
          return {
            imageUrl: 'https://example.com/panel.jpg',
            description: '生成的漫画面板',
            composition: 'medium_shot'
          }
        
        default:
          throw new Error(`Unknown AI service type: ${type}`)
      }
    }

    // POST /analyze-story - Analyze story structure
    if (method === 'POST' && action === 'analyze-story') {
      console.log('📖 Analyzing story structure...')
      
      const body = await req.json()
      const { projectId, story, style, language }: StoryAnalysisRequest = body

      if (!projectId || !story) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project ID and story are required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const { userId, deviceId } = await getUserIdentifier()

      // Verify project ownership
      let projectQuery = supabaseClient
        .from('projects')
        .select('id')
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
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      // Create generation job
      const job = await createGenerationJob(
        projectId,
        'story_analysis',
        { story, style, language },
        userId,
        deviceId
      )

      // Start processing (in a real implementation, this would be async)
      try {
        await updateGenerationJob(job.id, { status: 'processing', progress: 50 })
        
        const analysisResult = await callAIService('story_analysis', { story, style, language })
        
        await updateGenerationJob(job.id, {
          status: 'completed',
          progress: 100,
          result_data: analysisResult,
          completed_at: new Date().toISOString()
        })

        console.log('✅ Story analysis completed')

        return new Response(
          JSON.stringify({
            success: true,
            job: {
              id: job.id,
              status: 'completed',
              progress: 100,
              result: analysisResult
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      } catch (error) {
        await updateGenerationJob(job.id, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })

        throw error
      }
    }

    // POST /generate-character - Generate character image
    if (method === 'POST' && action === 'generate-character') {
      console.log('👤 Generating character...')
      
      const body = await req.json()
      const { projectId, characterName, description, style, referenceImages }: GenerateCharacterRequest = body

      if (!projectId || !characterName || !description) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project ID, character name, and description are required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const { userId, deviceId } = await getUserIdentifier()

      // Verify project ownership
      let projectQuery = supabaseClient
        .from('projects')
        .select('id')
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
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      // Create generation job
      const job = await createGenerationJob(
        projectId,
        'character_generation',
        { characterName, description, style, referenceImages },
        userId,
        deviceId
      )

      // Start processing
      try {
        await updateGenerationJob(job.id, { status: 'processing', progress: 50 })
        
        const characterResult = await callAIService('character_generation', {
          characterName,
          description,
          style,
          referenceImages
        })
        
        await updateGenerationJob(job.id, {
          status: 'completed',
          progress: 100,
          result_data: characterResult,
          completed_at: new Date().toISOString()
        })

        console.log('✅ Character generation completed')

        return new Response(
          JSON.stringify({
            success: true,
            job: {
              id: job.id,
              status: 'completed',
              progress: 100,
              result: characterResult
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      } catch (error) {
        await updateGenerationJob(job.id, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })

        throw error
      }
    }

    // GET /jobs/{jobId} - Get generation job status
    if (method === 'GET' && action.startsWith('jobs/')) {
      const jobId = action.split('/')[1]
      console.log('📊 Getting job status:', jobId)

      const { userId, deviceId } = await getUserIdentifier()

      let jobQuery = supabaseClient
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)

      if (userId) {
        jobQuery = jobQuery.eq('user_id', userId)
      } else if (deviceId) {
        jobQuery = jobQuery.eq('device_id', deviceId)
      }

      const { data: job, error } = await jobQuery.single()

      if (error || !job) {
        return new Response(
          JSON.stringify({ success: false, error: 'Job not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          job: {
            id: job.id,
            projectId: job.project_id,
            type: job.type,
            status: job.status,
            progress: job.progress,
            result: job.result_data,
            error: job.error_message,
            createdAt: job.created_at,
            completedAt: job.completed_at
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )

  } catch (error) {
    console.error('❌ Manga generation error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
