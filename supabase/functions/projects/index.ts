import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface ProjectRecord {
  id: string
  name: string
  description?: string
  story: string
  style: string
  status?: 'draft' | 'generating' | 'completed' | 'published'
  visibility?: 'private' | 'public' | 'shared'
  tags?: string[]
  ai_model?: string
  user_id?: string
  device_id?: string
  image_size?: any
  generation_state?: any
  r2_path?: string
  metadata?: {
    panel_count?: number
    character_count?: number
    estimated_read_time?: number
    language?: string
  }
  created_at?: string
  updated_at?: string
}

interface CreateProjectParams {
  name: string
  description?: string
  story: string
  style: string
  tags?: string[]
  visibility?: 'private' | 'public' | 'shared'
  settings?: {
    imageSize?: any
    aiModel?: string
    language?: string
  }
}

interface UpdateProjectParams {
  name?: string
  description?: string
  story?: string
  style?: string
  status?: 'draft' | 'generating' | 'completed' | 'published'
  visibility?: 'private' | 'public' | 'shared'
  tags?: string[]
  ai_model?: string
  image_size?: any
  generation_state?: any
  metadata?: {
    panel_count?: number
    character_count?: number
    estimated_read_time?: number
    language?: string
  }
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

    // Extract route parameters
    const isProjectsRoute = pathSegments[pathSegments.length - 1] === 'projects'
    const projectId = !isProjectsRoute ? pathSegments[pathSegments.length - 1] : null
    const action = pathSegments[pathSegments.length - 2] === 'projects' && pathSegments.length > 2 ?
                   pathSegments[pathSegments.length - 1] : null

    console.log('🛣️ Route info:', { method, pathSegments, isProjectsRoute, projectId, action })

    // Get user identifier (authenticated user or device ID)
    const getUserIdentifier = async () => {
      const authHeader = req.headers.get('authorization')
      const deviceId = req.headers.get('x-device-id')

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '')

        // Skip if it's just the anon key
        if (token === Deno.env.get('SUPABASE_ANON_KEY')) {
          console.log('🔓 Using anon key, treating as anonymous user')
        } else {
          // Try to get authenticated user with the provided token
          try {
            console.log('🔍 Verifying JWT token:', token.substring(0, 20) + '...')
            const { data: { user }, error } = await supabaseClient.auth.getUser(token)
            if (error) {
              console.log('⚠️ JWT verification error:', error.message)
            } else if (user) {
              console.log('✅ Authenticated user found:', user.id, user.email)
              return { userId: user.id, deviceId: null }
            } else {
              console.log('⚠️ JWT token valid but no user found')
            }
          } catch (error) {
            console.log('⚠️ Failed to verify user token:', error.message)
          }
        }
      }

      // Fall back to device ID for anonymous users
      if (deviceId) {
        return { userId: null, deviceId }
      }

      throw new Error('No user identifier found')
    }

    // Generate project ID
    const generateProjectId = (): string => {
      return `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    // GET /projects - Get project list or specific project
    if (method === 'GET') {
      const { userId, deviceId } = await getUserIdentifier()
      console.log('🔍 User identifier:', { userId: userId ? 'authenticated' : null, deviceId })

      // Handle specific project request: GET /projects/{id}
      if (projectId && projectId !== 'recent' && projectId !== 'search') {
        console.log('📄 Getting specific project:', projectId)

        let query = supabaseClient
          .from('projects')
          .select('*')
          .eq('id', projectId)

        // Ensure user can only access their own projects
        if (userId) {
          query = query.eq('user_id', userId)
        } else if (deviceId) {
          query = query.eq('device_id', deviceId)
        }

        const { data, error } = await query.single()

        if (error) {
          console.error('❌ Project not found:', error)
          return new Response(
            JSON.stringify({ success: false, error: 'Project not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }

        const project = {
          id: data.id,
          name: data.name,
          description: data.description || '',
          story: data.story,
          style: data.style,
          status: data.status || 'draft',
          visibility: data.visibility || 'private',
          tags: data.tags || [],
          createdAt: new Date(data.created_at).getTime(),
          updatedAt: new Date(data.updated_at).getTime(),
          panelCount: data.metadata?.panel_count || 0,
          characterCount: data.metadata?.character_count || 0,
          imageSize: data.image_size || { width: 1024, height: 576, aspectRatio: '16:9' },
          metadata: data.metadata || {}
        }

        return new Response(
          JSON.stringify({ success: true, project }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      // Handle recent projects: GET /projects/recent
      if (projectId === 'recent') {
        console.log('📋 Getting recent projects...')
        const limit = parseInt(url.searchParams.get('limit') || '10')

        let query = supabaseClient
          .from('projects')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(limit)

        if (userId) {
          query = query.eq('user_id', userId)
        } else if (deviceId) {
          query = query.eq('device_id', deviceId)
        }

        const { data, error } = await query

        if (error) {
          throw new Error(`Failed to fetch recent projects: ${error.message}`)
        }

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
          JSON.stringify({ success: true, projects, total: projects.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      // Handle project list with search and pagination: GET /projects
      console.log('📋 Getting project list...')

      // Parse query parameters
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const search = url.searchParams.get('search') || ''
      const tag = url.searchParams.get('tag') || ''
      const status = url.searchParams.get('status') || ''
      const sortBy = url.searchParams.get('sort') || 'updated_at'
      const sortOrder = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc'

      const offset = (page - 1) * limit

      console.log('🔍 Query params:', { page, limit, search, tag, status, sortBy, sortOrder })

      let query = supabaseClient
        .from('projects')
        .select('*', { count: 'exact' })
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1)

      // Filter by user or device
      if (userId) {
        query = query.eq('user_id', userId)
      } else if (deviceId) {
        query = query.eq('device_id', deviceId)
      }

      // Add search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,story.ilike.%${search}%`)
      }

      // Add tag filter
      if (tag) {
        query = query.contains('tags', [tag])
      }

      // Add status filter
      if (status) {
        query = query.eq('status', status)
      }

      const { data, error, count } = await query

      if (error) {
        console.error('❌ Supabase query error:', error)
        throw new Error(`Failed to fetch projects: ${error.message}`)
      }

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
        visibility: project.visibility || 'private',
        tags: project.tags || [],
        imageSize: project.image_size || { width: 1024, height: 576, aspectRatio: '16:9' }
      }))

      const totalPages = Math.ceil((count || 0) / limit)

      console.log(`✅ Returning ${projects.length} projects (page ${page}/${totalPages})`)

      return new Response(
        JSON.stringify({
          success: true,
          projects,
          meta: {
            pagination: {
              page,
              limit,
              total: count || 0,
              totalPages
            }
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // POST /projects - Create new project or handle special actions
    if (method === 'POST') {
      const { userId, deviceId } = await getUserIdentifier()

      // Handle project duplication: POST /projects/{id}/duplicate
      if (action === 'duplicate' && projectId) {
        console.log('📋 Duplicating project:', projectId)

        const body = await req.json()
        const { name: newName } = body

        // Get original project
        let query = supabaseClient
          .from('projects')
          .select('*')
          .eq('id', projectId)

        if (userId) {
          query = query.eq('user_id', userId)
        } else if (deviceId) {
          query = query.eq('device_id', deviceId)
        }

        const { data: originalProject, error: fetchError } = await query.single()

        if (fetchError || !originalProject) {
          return new Response(
            JSON.stringify({ success: false, error: 'Original project not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }

        // Create duplicate
        const duplicateId = generateProjectId()
        const now = new Date().toISOString()

        const duplicateData: Partial<ProjectRecord> = {
          ...originalProject,
          id: duplicateId,
          name: newName || `${originalProject.name} (Copy)`,
          r2_path: userId ? `users/${userId}/projects/${duplicateId}` : `anonymous/${deviceId}/projects/${duplicateId}`,
          created_at: now,
          updated_at: now,
        }

        const { data, error } = await supabaseClient
          .from('projects')
          .insert([duplicateData])
          .select()
          .single()

        if (error) {
          console.error('❌ Failed to duplicate project:', error)
          throw new Error(`Failed to duplicate project: ${error.message}`)
        }

        const project = {
          id: data.id,
          name: data.name,
          description: data.description || '',
          createdAt: new Date(data.created_at).getTime(),
          updatedAt: new Date(data.updated_at).getTime(),
          panelCount: data.metadata?.panel_count || 0,
          characterCount: data.metadata?.character_count || 0,
          style: data.style,
          status: data.status || 'draft',
          imageSize: data.image_size || { width: 1024, height: 576, aspectRatio: '16:9' }
        }

        console.log(`✅ Project duplicated: ${project.id}`)

        return new Response(
          JSON.stringify({ success: true, project }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      // Handle regular project creation: POST /projects
      console.log('🔧 Creating new project...')

      const body = await req.json()
      const { name, description, story, style, tags, visibility, settings }: CreateProjectParams = body

      if (!name || !story) {
        return new Response(
          JSON.stringify({ success: false, error: 'Name and story are required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }

      const newProjectId = generateProjectId()
      const now = new Date().toISOString()

      const projectData: Partial<ProjectRecord> = {
        id: newProjectId,
        name,
        description: description || '',
        story,
        style: style || 'manga',
        status: 'draft',
        visibility: visibility || 'private',
        tags: tags || [],
        ai_model: settings?.aiModel || 'auto',
        user_id: userId,
        device_id: deviceId,
        image_size: settings?.imageSize || { width: 1024, height: 576, aspectRatio: '16:9' },
        generation_state: null,
        metadata: {
          panel_count: 0,
          character_count: 0,
          estimated_read_time: Math.ceil(story.length / 200), // Rough estimate
          language: settings?.language || 'zh'
        },
        r2_path: userId ? `users/${userId}/projects/${newProjectId}` : `anonymous/${deviceId}/projects/${newProjectId}`,
        created_at: now,
        updated_at: now,
      }

      const { data, error } = await supabaseClient
        .from('projects')
        .insert([projectData])
        .select()
        .single()

      if (error) {
        console.error('❌ Failed to create project:', error)
        throw new Error(`Failed to create project: ${error.message}`)
      }

      const project = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        createdAt: new Date(data.created_at).getTime(),
        updatedAt: new Date(data.updated_at).getTime(),
        panelCount: data.metadata?.panel_count || 0,
        characterCount: data.metadata?.character_count || 0,
        style: data.style,
        status: data.status || 'draft',
        visibility: data.visibility || 'private',
        tags: data.tags || [],
        imageSize: data.image_size || { width: 1024, height: 576, aspectRatio: '16:9' }
      }

      console.log(`✅ Project created: ${project.id}`)

      return new Response(
        JSON.stringify({
          success: true,
          project,
          projectId: project.id
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // PUT /projects/{id} - Update project
    if (method === 'PUT') {
      console.log('📝 Updating project...')

      // Get project ID from URL path or request body
      const updateProjectId = projectId || (await req.json()).projectId
      const body = projectId ? await req.json() : await req.json()
      const updateParams = projectId ? body : { ...body }
      delete updateParams.projectId // Remove projectId from update params if it exists

      if (!updateProjectId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project ID is required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }

      const { userId, deviceId } = await getUserIdentifier()

      // Build update data
      const updateData: Partial<ProjectRecord> = {
        ...updateParams,
        updated_at: new Date().toISOString(),
      }

      let query = supabaseClient
        .from('projects')
        .update(updateData)
        .eq('id', updateProjectId)

      // Ensure user can only update their own projects
      if (userId) {
        query = query.eq('user_id', userId)
      } else if (deviceId) {
        query = query.eq('device_id', deviceId)
      }

      const { error } = await query

      if (error) {
        console.error('❌ Failed to update project:', error)
        throw new Error(`Failed to update project: ${error.message}`)
      }

      console.log(`✅ Project updated: ${updateProjectId}`)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Project updated successfully'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // DELETE /projects - Delete project
    if (method === 'DELETE') {
      console.log('🗑️ Deleting project...')
      
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

      let query = supabaseClient
        .from('projects')
        .delete()
        .eq('id', projectId)

      // Ensure user can only delete their own projects
      if (userId) {
        query = query.eq('user_id', userId)
      } else if (deviceId) {
        query = query.eq('device_id', deviceId)
      }

      const { error } = await query

      if (error) {
        console.error('❌ Failed to delete project:', error)
        throw new Error(`Failed to delete project: ${error.message}`)
      }

      console.log(`✅ Project deleted: ${projectId}`)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Project deleted successfully'
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
