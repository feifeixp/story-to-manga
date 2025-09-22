import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface SharedWork {
  id: string
  project_id: string
  title: string
  description: string
  thumbnail_url?: string
  share_url: string
  visibility: 'public' | 'unlisted'
  tags: string[]
  stats: {
    views: number
    likes: number
    comments: number
    shares: number
  }
  user_id?: string
  device_id?: string
  published_at: string
  updated_at: string
}

interface PublishWorkRequest {
  projectId: string
  title: string
  description: string
  tags: string[]
  visibility: 'public' | 'unlisted'
  thumbnailUrl?: string
}

interface CreateLinkRequest {
  projectId: string
  expiresIn?: number // hours
  password?: string
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
    const action = pathSegments[pathSegments.length - 1]
    const shareId = pathSegments.length > 2 ? pathSegments[pathSegments.length - 1] : null

    console.log('🌐 Sharing API:', { method, action, shareId })

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

    // Generate UUID for share ID
    const generateShareId = (): string => {
      return crypto.randomUUID()
    }

    // POST /publish - Publish work
    if (method === 'POST' && action === 'publish') {
      console.log('📢 Publishing work...')
      
      const body = await req.json()
      const { projectId, title, description, tags, visibility, thumbnailUrl }: PublishWorkRequest = body

      if (!projectId || !title) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project ID and title are required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const { userId, deviceId } = await getUserIdentifier()

      // Verify project ownership
      let projectQuery = supabaseClient
        .from('projects')
        .select('id, name, style')
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

      // Check if already published
      const { data: existingShare } = await supabaseClient
        .from('shared_works')
        .select('id')
        .eq('project_id', projectId)
        .single()

      if (existingShare) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project is already published' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Create shared work
      const shareId = generateShareId()
      const now = new Date().toISOString()

      const sharedWorkData = {
        id: shareId,
        project_id: projectId,
        title,
        description: description || '',
        author_name: 'Anonymous', // 默认作者名
        cover_image: thumbnailUrl,
        style: 'manga', // 默认样式
        tags: tags || [],
        is_published: visibility === 'public',
        published_at: visibility === 'public' ? now : null,
        likes_count: 0,
        views_count: 0,
        user_id: userId,
        device_id: deviceId,
        created_at: now,
        updated_at: now,
      }

      const { data, error } = await supabaseClient
        .from('shared_works')
        .insert([sharedWorkData])
        .select()
        .single()

      if (error) {
        console.error('❌ Failed to publish work:', error)
        throw new Error(`Failed to publish work: ${error.message}`)
      }

      // Update project status
      await supabaseClient
        .from('projects')
        .update({ 
          status: 'published',
          visibility: 'public',
          updated_at: now
        })
        .eq('id', projectId)

      console.log(`✅ Work published: ${shareId}`)

      return new Response(
        JSON.stringify({
          success: true,
          work: {
            id: data.id,
            shareUrl: `${url.origin}/public/${data.id}`,
            title: data.title,
            description: data.description,
            visibility: data.is_published ? 'public' : 'private',
            publishedAt: data.published_at,
            projectId: data.project_id
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // GET /public/{shareId} - Get public work
    if (method === 'GET' && action === 'public' && shareId) {
      console.log('👁️ Getting public work:', shareId)

      const { data: sharedWork, error } = await supabaseClient
        .from('shared_works')
        .select(`
          *,
          projects (
            id,
            name,
            story,
            style,
            metadata
          )
        `)
        .eq('id', shareId)
        .single()

      if (error || !sharedWork) {
        return new Response(
          JSON.stringify({ success: false, error: 'Shared work not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      // Increment view count
      await supabaseClient
        .from('shared_works')
        .update({
          stats: {
            ...sharedWork.stats,
            views: (sharedWork.stats.views || 0) + 1
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', shareId)

      const publicWork = {
        id: sharedWork.id,
        title: sharedWork.title,
        description: sharedWork.description,
        thumbnailUrl: sharedWork.thumbnail_url,
        tags: sharedWork.tags,
        stats: {
          ...sharedWork.stats,
          views: (sharedWork.stats.views || 0) + 1
        },
        publishedAt: sharedWork.published_at,
        project: {
          name: sharedWork.projects.name,
          story: sharedWork.projects.story,
          style: sharedWork.projects.style,
          metadata: sharedWork.projects.metadata
        }
      }

      return new Response(
        JSON.stringify({ success: true, work: publicWork }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // GET /gallery - Get public gallery
    if (method === 'GET' && action === 'gallery') {
      console.log('🖼️ Getting public gallery...')

      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const sort = url.searchParams.get('sort') || 'latest'
      const tag = url.searchParams.get('tag') || ''
      
      const offset = (page - 1) * limit

      let query = supabaseClient
        .from('shared_works')
        .select(`
          *,
          projects (
            name,
            style,
            metadata
          )
        `, { count: 'exact' })
        .eq('visibility', 'public')
        .range(offset, offset + limit - 1)

      // Apply sorting
      switch (sort) {
        case 'popular':
          query = query.order('stats->views', { ascending: false })
          break
        case 'liked':
          query = query.order('stats->likes', { ascending: false })
          break
        case 'latest':
        default:
          query = query.order('published_at', { ascending: false })
          break
      }

      // Apply tag filter
      if (tag) {
        query = query.contains('tags', [tag])
      }

      const { data, error, count } = await query

      if (error) {
        console.error('❌ Failed to get gallery:', error)
        throw new Error(`Failed to get gallery: ${error.message}`)
      }

      const works = (data || []).map(work => ({
        id: work.id,
        title: work.title,
        description: work.description,
        thumbnailUrl: work.thumbnail_url,
        tags: work.tags,
        stats: work.stats,
        publishedAt: work.published_at,
        project: {
          name: work.projects.name,
          style: work.projects.style,
          panelCount: work.projects.metadata?.panel_count || 0
        }
      }))

      const totalPages = Math.ceil((count || 0) / limit)

      return new Response(
        JSON.stringify({
          success: true,
          works,
          meta: {
            pagination: {
              page,
              limit,
              total: count || 0,
              totalPages
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // POST /like - Like a work
    if (method === 'POST' && action === 'like') {
      console.log('❤️ Liking work...')

      const body = await req.json()
      const { shareId } = body

      if (!shareId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Share ID is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Get current stats
      const { data: sharedWork, error } = await supabaseClient
        .from('shared_works')
        .select('stats')
        .eq('id', shareId)
        .single()

      if (error || !sharedWork) {
        return new Response(
          JSON.stringify({ success: false, error: 'Shared work not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      // Update like count
      const newStats = {
        ...sharedWork.stats,
        likes: (sharedWork.stats.likes || 0) + 1
      }

      await supabaseClient
        .from('shared_works')
        .update({
          stats: newStats,
          updated_at: new Date().toISOString()
        })
        .eq('id', shareId)

      return new Response(
        JSON.stringify({
          success: true,
          stats: newStats
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
    console.error('❌ Sharing error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
