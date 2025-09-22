import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand, GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3'
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// 环境变量
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const R2_ENDPOINT = Deno.env.get('R2_ENDPOINT')!
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!
const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME')!
const R2_PUBLIC_DOMAIN = Deno.env.get('R2_PUBLIC_DOMAIN')!

// 创建Supabase客户端
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 创建R2客户端
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const method = req.method

    console.log(`🌐 [R2PresignedURL] ${method}`)

    // 获取用户标识
    const getUserIdentifier = async () => {
      const authHeader = req.headers.get('authorization')
      const deviceId = req.headers.get('x-device-id')
      
      let userId = null
      
      if (authHeader) {
        try {
          const token = authHeader.replace('Bearer ', '')
          const { data: { user } } = await supabaseClient.auth.getUser(token)
          userId = user?.id
        } catch (error) {
          console.log('Auth token invalid, using device ID')
        }
      }
      
      return { userId, deviceId }
    }

    const { userId, deviceId } = await getUserIdentifier()
    
    if (!userId && !deviceId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No user identifier found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // 生成用户路径前缀
    const generateUserPrefix = () => {
      return userId ? `users/${userId}` : `anonymous/${deviceId}`
    }

    // POST - 获取预签名URL
    if (method === 'POST') {
      const body = await req.json()
      const { filePath, contentType, operation } = body

      if (!filePath || !contentType || !operation) {
        return new Response(
          JSON.stringify({ success: false, error: 'filePath, contentType, and operation are required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log(`🔗 [R2PresignedURL] Generating ${operation} URL for: ${filePath}`)

      try {
        // 添加用户前缀到文件路径
        const userPrefix = generateUserPrefix()
        const fullPath = `${userPrefix}/${filePath}`

        let signedUrl: string
        let publicUrl: string

        if (operation === 'upload') {
          // 生成上传预签名URL
          const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fullPath,
            ContentType: contentType,
            Metadata: {
              'user-id': userId || 'anonymous',
              'device-id': deviceId || 'unknown',
              'uploaded-at': new Date().toISOString(),
            },
          })

          signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 }) // 1小时有效期
          publicUrl = `${R2_PUBLIC_DOMAIN}/${fullPath}`

          console.log(`✅ [R2PresignedURL] Upload URL generated: ${fullPath}`)

          return new Response(
            JSON.stringify({ 
              success: true, 
              uploadUrl: signedUrl,
              publicUrl: publicUrl,
              filePath: fullPath
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )

        } else if (operation === 'download') {
          // 生成下载预签名URL
          const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fullPath,
          })

          signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 }) // 1小时有效期
          publicUrl = `${R2_PUBLIC_DOMAIN}/${fullPath}`

          console.log(`✅ [R2PresignedURL] Download URL generated: ${fullPath}`)

          return new Response(
            JSON.stringify({ 
              success: true, 
              downloadUrl: signedUrl,
              publicUrl: publicUrl,
              filePath: fullPath
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )

        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid operation. Use "upload" or "download"' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

      } catch (error) {
        console.error('❌ [R2PresignedURL] Failed to generate presigned URL:', error)
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    // GET - 健康检查
    if (method === 'GET') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'R2 Presigned URL service is healthy',
          timestamp: new Date().toISOString(),
          config: {
            r2Endpoint: R2_ENDPOINT,
            r2Bucket: R2_BUCKET_NAME,
            r2PublicDomain: R2_PUBLIC_DOMAIN,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 不支持的方法
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )

  } catch (error) {
    console.error('❌ [R2PresignedURL] Function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
