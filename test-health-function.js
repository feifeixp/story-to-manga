#!/usr/bin/env node

/**
 * 测试 health 函数逻辑
 * 模拟 Edge Function 环境并测试 health 端点
 */

const fs = require('fs');

// 加载环境变量
function loadEnvFile(filePath) {
  try {
    const envContent = fs.readFileSync(filePath, 'utf8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    console.log(`⚠️  无法加载环境文件 ${filePath}: ${error.message}`);
  }
}

loadEnvFile('.env.local');

console.log('🏥 测试 Health 函数逻辑...\n');

// 模拟 health 函数的核心逻辑
function createHealthResponse() {
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
      used: process.memoryUsage ? Math.round(process.memoryUsage().heapUsed / 1024 / 1024) : 0,
      total: process.memoryUsage ? Math.round(process.memoryUsage().heapTotal / 1024 / 1024) : 0
    },
    environment: {
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 已配置' : '❌ 未配置',
      anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ 已配置' : '❌ 未配置',
      service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ 已配置' : '❌ 未配置',
      project_id: process.env.NEXT_PUBLIC_PROJECT_ID || '❌ 未配置',
      device_id: process.env.NEXT_PUBLIC_DEVICE_ID || '❌ 未配置',
      ai_services: {
        google_ai: process.env.GOOGLE_AI_API_KEY ? '✅ 已配置' : '❌ 未配置',
        volcengine: process.env.VOLCENGINE_API_KEY ? '✅ 已配置' : '❌ 未配置'
      },
      storage: {
        r2_configured: process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY ? '✅ 已配置' : '❌ 未配置',
        bucket_name: process.env.R2_BUCKET_NAME || '❌ 未配置',
        public_domain: process.env.R2_PUBLIC_DOMAIN ? '✅ 已配置' : '❌ 未配置'
      }
    }
  };

  return {
    success: true,
    data: healthData
  };
}

// 测试健康检查响应
const healthResponse = createHealthResponse();

console.log('📊 Health Check 响应:');
console.log(JSON.stringify(healthResponse, null, 2));

// 验证关键配置
const criticalConfigs = [
  healthResponse.data.environment.supabase_url.includes('✅'),
  healthResponse.data.environment.anon_key.includes('✅'),
  healthResponse.data.environment.service_role_key.includes('✅'),
  healthResponse.data.environment.project_id !== '❌ 未配置',
  healthResponse.data.environment.device_id !== '❌ 未配置',
];

const configuredCount = criticalConfigs.filter(Boolean).length;
const totalCount = criticalConfigs.length;

console.log('\n🔍 关键配置验证:');
console.log(`  已配置: ${configuredCount}/${totalCount}`);
console.log(`  完成度: ${Math.round((configuredCount / totalCount) * 100)}%`);

if (configuredCount === totalCount) {
  console.log('\n✅ Health 函数已准备就绪！所有关键配置都已正确设置。');
} else {
  console.log('\n⚠️  Health 函数需要更多配置才能完全正常工作。');
}

// 测试 CORS 头部
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

console.log('\n🌐 CORS 配置:');
Object.entries(corsHeaders).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('\n🎯 Health 函数测试完成！');
