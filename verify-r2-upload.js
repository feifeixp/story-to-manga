#!/usr/bin/env node

/**
 * 验证R2上传是否成功
 */

const https = require('https');

const testUrl = 'https://fac7207421271dd5183fcab70164cad1.r2.cloudflarestorage.com/mangashare/anonymous/anon_test_1758288809911_yoaskzq8d/projects/test-project-1758288809911/panels/panel_1.jpg';

console.log('🔍 验证R2文件上传...');
console.log('URL:', testUrl);

https.get(testUrl, (res) => {
  console.log('\n📊 响应状态:', res.statusCode);
  console.log('📋 响应头:');
  Object.entries(res.headers).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  if (res.statusCode === 200) {
    console.log('\n✅ 文件上传成功！可以正常访问。');
    
    let dataLength = 0;
    res.on('data', (chunk) => {
      dataLength += chunk.length;
    });
    
    res.on('end', () => {
      console.log(`📦 文件大小: ${dataLength} 字节`);
    });
  } else {
    console.log('\n❌ 文件访问失败，状态码:', res.statusCode);
  }
}).on('error', (err) => {
  console.log('\n❌ 请求出错:', err.message);
});

// 同时测试API获取
console.log('\n🔍 测试通过API获取文件...');

const http = require('http');
const querystring = require('querystring');

const params = querystring.stringify({
  userId: 'anon_test_1758288809911_yoaskzq8d',
  projectId: 'test-project-1758288809911',
  panelNumber: '1'
});

const apiUrl = `http://localhost:8001/api/storage/panel?${params}`;

const req = http.get(apiUrl, {
  headers: {
    'X-Device-ID': 'anon_test_1758288809911_yoaskzq8d'
  }
}, (res) => {
  console.log('API响应状态:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.success) {
        console.log('✅ API获取成功!');
        console.log('面板号:', result.panelNumber);
        console.log('有图片数据:', !!result.imageData);
        console.log('图片数据长度:', result.imageData ? result.imageData.length : 0);
      } else {
        console.log('❌ API获取失败:', result.error);
      }
    } catch (error) {
      console.log('❌ API响应解析失败:', error.message);
      console.log('原始响应:', data);
    }
  });
});

req.on('error', (err) => {
  console.log('❌ API请求出错:', err.message);
});
