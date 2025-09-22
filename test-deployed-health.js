#!/usr/bin/env node

/**
 * 测试已部署的 Health Edge Function
 * 验证函数是否正常工作并返回正确的健康状态
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.log('❌ 缺少必要的 Supabase 配置');
  process.exit(1);
}

const HEALTH_URL = `${SUPABASE_URL}/functions/v1/health`;

console.log('🏥 测试已部署的 Health Edge Function...\n');
console.log(`📍 测试 URL: ${HEALTH_URL}\n`);

// 测试函数
async function testHealthFunction() {
  const tests = [
    {
      name: '无认证的 GET 请求',
      options: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    },
    {
      name: '带 Anon Key 的 GET 请求',
      options: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        }
      }
    },
    {
      name: 'OPTIONS 请求 (CORS 预检)',
      options: {
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
        }
      }
    },
    {
      name: 'POST 请求 (应该返回 405)',
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
        },
        body: JSON.stringify({ test: 'data' })
      }
    }
  ];

  for (const test of tests) {
    console.log(`🧪 测试: ${test.name}`);
    
    try {
      const response = await fetch(HEALTH_URL, test.options);
      
      console.log(`   状态码: ${response.status} ${response.statusText}`);
      
      // 检查 CORS 头部
      const corsHeaders = [
        'access-control-allow-origin',
        'access-control-allow-headers',
        'access-control-allow-methods'
      ];
      
      corsHeaders.forEach(header => {
        const value = response.headers.get(header);
        if (value) {
          console.log(`   ${header}: ${value}`);
        }
      });
      
      // 尝试解析响应体
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          const data = await response.json();
          console.log(`   响应体:`, JSON.stringify(data, null, 4));
        } catch (e) {
          console.log(`   响应体解析失败: ${e.message}`);
        }
      } else {
        const text = await response.text();
        console.log(`   响应体: ${text}`);
      }
      
      // 验证响应
      if (test.name.includes('GET') && response.ok) {
        console.log('   ✅ 测试通过');
      } else if (test.name.includes('OPTIONS') && response.ok) {
        console.log('   ✅ CORS 预检通过');
      } else if (test.name.includes('POST') && response.status === 405) {
        console.log('   ✅ 正确拒绝了不支持的方法');
      } else {
        console.log(`   ⚠️  意外的响应状态: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`   ❌ 请求失败: ${error.message}`);
    }
    
    console.log('');
  }
}

// 运行测试
testHealthFunction().then(() => {
  console.log('🎯 Health Function 测试完成！');
}).catch(error => {
  console.error('❌ 测试过程中发生错误:', error);
  process.exit(1);
});
