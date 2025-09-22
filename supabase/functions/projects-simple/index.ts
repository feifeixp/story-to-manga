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
    console.log('🚀 Simple projects function called')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Simple user identification
    const getUserIdentifier = async () => {
      const authHeader = req.headers.get('authorization')
      const deviceId = req.headers.get('x-device-id')

      console.log('🔍 Auth header present:', !!authHeader)
      console.log('🔍 Device ID present:', !!deviceId)

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '')
        
        // Skip if it's just the anon key
        if (token !== Deno.env.get('SUPABASE_ANON_KEY')) {
          try {
            const { data: { user }, error } = await supabaseClient.auth.getUser(token)
            if (!error && user) {
              console.log('✅ Authenticated user:', user.email)
              return { userId: user.id, deviceId: null }
            }
          } catch (error) {
            console.log('⚠️ Token verification failed:', error.message)
          }
        }
      }

      // Fall back to device ID
      if (deviceId) {
        console.log('🔐 Using device ID:', deviceId)
        return { userId: null, deviceId }
      }

      throw new Error('No user identifier found')
    }

    const method = req.method
    console.log('📝 Method:', method)

    if (method === 'GET') {
      const { userId, deviceId } = await getUserIdentifier()
      console.log('👤 User ID:', userId)
      console.log('📱 Device ID:', deviceId)

      // Get projects
      let query = supabaseClient
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(20)

      // Filter by user or device
      if (userId) {
        query = query.eq('user_id', userId)
      } else if (deviceId) {
        query = query.eq('device_id', deviceId)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Database error:', error)
        throw new Error(`Failed to fetch projects: ${error.message}`)
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

    // Method not allowed
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )

  } catch (error) {
    console.error('❌ Function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
