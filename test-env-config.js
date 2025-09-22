#!/usr/bin/env node

/**
 * 测试环境变量配置
 * 验证所有必要的 Supabase 和其他服务配置是否正确设置
 */

const fs = require('fs');
const path = require('path');

// 手动加载 .env.local 文件
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

// 加载环境变量
loadEnvFile('.env.local');

console.log('🔍 检查环境变量配置...\n');

// 检查 Supabase 配置
const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  deviceId: process.env.NEXT_PUBLIC_DEVICE_ID,
};

console.log('📊 Supabase 配置:');
console.log(`  URL: ${supabaseConfig.url ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`  Anon Key: ${supabaseConfig.anonKey ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`  Service Role Key: ${supabaseConfig.serviceRoleKey ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`  Project ID: ${supabaseConfig.projectId || '❌ 未设置'}`);
console.log(`  Device ID: ${supabaseConfig.deviceId || '❌ 未设置'}`);

// 检查 AI 服务配置
const aiConfig = {
  googleAI: process.env.GOOGLE_AI_API_KEY,
  volcengine: process.env.VOLCENGINE_API_KEY,
  defaultModel: process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL,
};

console.log('\n🤖 AI 服务配置:');
console.log(`  Google AI API Key: ${aiConfig.googleAI ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`  VolcEngine API Key: ${aiConfig.volcengine ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`  默认 AI 模型: ${aiConfig.defaultModel || '❌ 未设置'}`);

// 检查 R2 存储配置
const r2Config = {
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  accountId: process.env.R2_ACCOUNT_ID,
  bucketName: process.env.R2_BUCKET_NAME,
  endpoint: process.env.R2_ENDPOINT,
  publicDomain: process.env.R2_PUBLIC_DOMAIN,
};

console.log('\n☁️ Cloudflare R2 存储配置:');
console.log(`  Access Key ID: ${r2Config.accessKeyId ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`  Secret Access Key: ${r2Config.secretAccessKey ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`  Account ID: ${r2Config.accountId ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`  Bucket Name: ${r2Config.bucketName || '❌ 未设置'}`);
console.log(`  Endpoint: ${r2Config.endpoint ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`  Public Domain: ${r2Config.publicDomain ? '✅ 已设置' : '❌ 未设置'}`);

// 检查应用配置
const appConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  gaId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
};

console.log('\n🌐 应用程序配置:');
console.log(`  App URL: ${appConfig.appUrl || '❌ 未设置'}`);
console.log(`  Google Analytics ID: ${appConfig.gaId ? '✅ 已设置' : '❌ 未设置'}`);

// 总结
const requiredConfigs = [
  supabaseConfig.url,
  supabaseConfig.anonKey,
  supabaseConfig.serviceRoleKey,
  supabaseConfig.projectId,
  supabaseConfig.deviceId,
  aiConfig.googleAI,
  r2Config.accessKeyId,
  r2Config.secretAccessKey,
  r2Config.accountId,
  r2Config.bucketName,
  r2Config.endpoint,
  r2Config.publicDomain,
  appConfig.appUrl,
];

const configuredCount = requiredConfigs.filter(config => config).length;
const totalCount = requiredConfigs.length;

console.log('\n📋 配置总结:');
console.log(`  已配置: ${configuredCount}/${totalCount}`);
console.log(`  完成度: ${Math.round((configuredCount / totalCount) * 100)}%`);

if (configuredCount === totalCount) {
  console.log('\n🎉 所有必要的环境变量都已正确配置！');
} else {
  console.log('\n⚠️  还有一些环境变量需要配置。');
}

// 测试 Supabase 连接
if (supabaseConfig.url && supabaseConfig.anonKey) {
  console.log('\n🔗 测试 Supabase 连接...');
  
  const testSupabaseConnection = async () => {
    try {
      const response = await fetch(`${supabaseConfig.url}/rest/v1/`, {
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        },
      });
      
      if (response.ok) {
        console.log('✅ Supabase 连接成功！');
      } else {
        console.log(`❌ Supabase 连接失败: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ Supabase 连接错误: ${error.message}`);
    }
  };
  
  testSupabaseConnection();
} else {
  console.log('\n⚠️  无法测试 Supabase 连接：缺少必要的配置');
}
