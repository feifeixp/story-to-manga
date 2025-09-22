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
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const method = req.method

    console.log(`🌐 [R2Storage] ${method} ${action}`)

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

    // 生成用户路径
    const generateUserPath = (projectId: string, fileName: string) => {
      const userPrefix = userId ? `users/${userId}` : `anonymous/${deviceId}`
      return `${userPrefix}/projects/${projectId}/${fileName}`
    }

    // POST - 保存项目数据
    if (method === 'POST' && action === 'save-project') {
      const body = await req.json()
      const { projectId, data } = body

      if (!projectId || !data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project ID and data are required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log(`💾 [R2Storage] Saving project: ${projectId}`)

      try {
        // 1. 保存完整JSON数据到R2
        const jsonPath = generateUserPath(projectId, 'project-complete.json')
        const jsonData = JSON.stringify(data, null, 2)
        
        await r2Client.send(new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: jsonPath,
          Body: new TextEncoder().encode(jsonData),
          ContentType: 'application/json',
          Metadata: {
            'project-id': projectId,
            'user-id': userId || 'anonymous',
            'device-id': deviceId || 'unknown',
            'saved-at': new Date().toISOString(),
          },
        }))

        console.log(`✅ [R2Storage] JSON saved to: ${jsonPath}`)

        // 2. 保存图片到R2
        let savedImages = 0
        
        // 保存生成的面板图片
        if (data.generation?.generatedPanels) {
          for (const panel of data.generation.generatedPanels) {
            if (panel.image && panel.image.startsWith('data:image/')) {
              try {
                const imagePath = generateUserPath(projectId, `panels/panel-${panel.panelNumber}.jpg`)
                
                // 转换base64为buffer
                const base64Data = panel.image.replace(/^data:image\/[a-z]+;base64,/, '')
                const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
                
                await r2Client.send(new PutObjectCommand({
                  Bucket: R2_BUCKET_NAME,
                  Key: imagePath,
                  Body: imageBuffer,
                  ContentType: 'image/jpeg',
                  Metadata: {
                    'project-id': projectId,
                    'panel-number': panel.panelNumber.toString(),
                    'saved-at': new Date().toISOString(),
                  },
                }))

                // 更新面板数据中的图片URL为R2 URL
                panel.image = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${imagePath}`
                savedImages++
                
                console.log(`✅ [R2Storage] Panel image saved: ${imagePath}`)
              } catch (imageError) {
                console.error(`❌ [R2Storage] Failed to save panel image:`, imageError)
              }
            }
          }
        }

        // 保存角色参考图片
        if (data.generation?.characterReferences) {
          for (const char of data.generation.characterReferences) {
            if (char.image && char.image.startsWith('data:image/')) {
              try {
                const imagePath = generateUserPath(projectId, `characters/${char.name}.jpg`)
                
                const base64Data = char.image.replace(/^data:image\/[a-z]+;base64,/, '')
                const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
                
                await r2Client.send(new PutObjectCommand({
                  Bucket: R2_BUCKET_NAME,
                  Key: imagePath,
                  Body: imageBuffer,
                  ContentType: 'image/jpeg',
                  Metadata: {
                    'project-id': projectId,
                    'character-name': char.name,
                    'saved-at': new Date().toISOString(),
                  },
                }))

                // 更新角色数据中的图片URL
                char.image = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${imagePath}`
                savedImages++
                
                console.log(`✅ [R2Storage] Character image saved: ${imagePath}`)
              } catch (imageError) {
                console.error(`❌ [R2Storage] Failed to save character image:`, imageError)
              }
            }
          }
        }

        // 3. 重新保存更新后的JSON（包含R2 URL）
        const updatedJsonData = JSON.stringify(data, null, 2)
        await r2Client.send(new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: jsonPath,
          Body: new TextEncoder().encode(updatedJsonData),
          ContentType: 'application/json',
          Metadata: {
            'project-id': projectId,
            'user-id': userId || 'anonymous',
            'device-id': deviceId || 'unknown',
            'saved-at': new Date().toISOString(),
            'images-count': savedImages.toString(),
          },
        }))

        // 4. 更新数据库记录
        const { error: dbError } = await supabaseClient
          .from('projects')
          .upsert({
            id: projectId,
            user_id: userId,
            device_id: deviceId,
            title: data.metadata?.name || `项目 ${new Date().toLocaleDateString()}`,
            description: data.content?.story?.substring(0, 200) || '',
            story: data.content?.story || '',
            style: data.content?.style || 'manga',
            image_size: data.content?.imageSize,
            generation_state: data.generation?.generationState,
            ai_model: data.content?.aiModel || 'auto',
            r2_path: generateUserPath(projectId, ''),
            panel_count: data.generation?.generatedPanels?.length || 0,
            character_count: data.generation?.characterReferences?.length || 0,
            updated_at: new Date().toISOString(),
          })

        if (dbError) {
          console.error('❌ [R2Storage] Database update failed:', dbError)
        } else {
          console.log('✅ [R2Storage] Database updated')
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Project saved with ${savedImages} images`,
            r2Path: jsonPath,
            imagesCount: savedImages
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      } catch (error) {
        console.error('❌ [R2Storage] Save failed:', error)
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    // GET - 加载项目数据
    if (method === 'GET' && action === 'load-project') {
      const projectId = url.searchParams.get('projectId')
      
      if (!projectId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Project ID is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log(`📂 [R2Storage] Loading project: ${projectId}`)

      try {
        const jsonPath = generateUserPath(projectId, 'project-complete.json')
        
        const response = await r2Client.send(new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: jsonPath,
        }))

        if (!response.Body) {
          return new Response(
            JSON.stringify({ success: false, error: 'Project data not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }

        // 读取数据
        const chunks = []
        const reader = response.Body.getReader()
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
        }
        
        const dataBuffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
        let offset = 0
        for (const chunk of chunks) {
          dataBuffer.set(chunk, offset)
          offset += chunk.length
        }
        
        const jsonData = new TextDecoder().decode(dataBuffer)
        const projectData = JSON.parse(jsonData)

        console.log(`✅ [R2Storage] Project loaded from: ${jsonPath}`)

        return new Response(
          JSON.stringify({ success: true, data: projectData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      } catch (error) {
        console.error('❌ [R2Storage] Load failed:', error)
        
        if (error.name === 'NoSuchKey') {
          return new Response(
            JSON.stringify({ success: false, error: 'Project not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }

        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    // 不支持的操作
    return new Response(
      JSON.stringify({ success: false, error: 'Unsupported action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )

  } catch (error) {
    console.error('❌ [R2Storage] Function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
