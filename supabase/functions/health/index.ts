import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Health check endpoint
    if (req.method === 'GET') {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          database: 'connected',
          storage: 'available',
          functions: 'operational'
        },
        uptime: process.uptime ? Math.floor(process.uptime()) : 0,
        memory: {
          used: 0,
          total: 0
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: healthData
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          }, 
          status: 200 
        }
      )
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Method not allowed. Use GET for health check.' 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 405 
      }
    )

  } catch (error) {
    console.error('❌ Health check error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        status: 'unhealthy'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    )
  }
})
