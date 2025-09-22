#!/usr/bin/env node

/**
 * Story to Manga API 端点测试脚本
 * 测试所有主要 API 端点的功能
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

// API 配置
const API_BASE_URL = 'https://tairvnwvltidxcscsusl.supabase.co/functions/v1';
const API_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DEVICE_ID = 'test-device-' + Date.now();

const headers = {
  'Content-Type': 'application/json',
  'apikey': API_KEY,
  'Authorization': `Bearer ${API_KEY}`,
  'x-device-id': DEVICE_ID
};

// 测试结果收集
const testResults = [];

// 添加测试结果
const addResult = (test, success, message, data = null) => {
  testResults.push({ test, success, message, data, timestamp: new Date().toISOString() });
  const status = success ? '✅' : '❌';
  console.log(`${status} ${test}: ${message}`);
  if (data && process.env.DEBUG) {
    console.log('   数据:', JSON.stringify(data, null, 2));
  }
};

// API 调用包装器
const apiCall = async (name, url, options = {}) => {
  try {
    const response = await fetch(url, {
      headers,
      ...options
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }
    
    addResult(name, true, `成功 (${response.status})`, data);
    return data;
  } catch (error) {
    addResult(name, false, error.message);
    throw error;
  }
};

// 测试函数
const tests = {
  // 1. 健康检查
  async healthCheck() {
    return await apiCall(
      '健康检查',
      `${API_BASE_URL}/health`
    );
  },

  // 2. 项目管理测试
  async projectManagement() {
    let projectId = null;
    
    try {
      // 获取项目列表
      const projects = await apiCall(
        '获取项目列表',
        `${API_BASE_URL}/projects`
      );

      // 创建新项目
      const newProject = await apiCall(
        '创建新项目',
        `${API_BASE_URL}/projects`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: `API测试项目-${Date.now()}`,
            description: '这是一个API测试项目',
            story: '在一个风雨交加的夜晚，年轻的剑客踏上了复仇之路...',
            style: 'manga',
            tags: ['测试', 'API'],
            imageSize: {
              width: 1024,
              height: 576,
              aspectRatio: '16:9'
            }
          })
        }
      );

      if (newProject.success && newProject.project) {
        projectId = newProject.project.id;

        // 获取单个项目
        await apiCall(
          '获取单个项目',
          `${API_BASE_URL}/projects/${projectId}`
        );

        // 删除项目
        await apiCall(
          '删除项目',
          `${API_BASE_URL}/projects?projectId=${projectId}`,
          { method: 'DELETE' }
        );
      }
    } catch (error) {
      console.error('项目管理测试失败:', error.message);
    }
  },

  // 3. 项目数据存储测试
  async projectStorage() {
    try {
      // 先创建一个项目用于测试
      const newProject = await apiCall(
        '创建测试项目（存储）',
        `${API_BASE_URL}/projects`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: `存储测试项目-${Date.now()}`,
            story: '测试故事内容',
            style: 'manga'
          })
        }
      );

      if (newProject.success && newProject.project) {
        const projectId = newProject.project.id;

        // 保存项目数据
        await apiCall(
          '保存项目数据',
          `${API_BASE_URL}/project-storage-working`,
          {
            method: 'POST',
            body: JSON.stringify({
              projectId: projectId,
              story: '更新的故事内容',
              style: 'manga',
              storyAnalysis: { summary: '测试分析' },
              characterReferences: [
                {
                  id: 'char1',
                  name: '主角',
                  description: '年轻的剑客'
                }
              ],
              generatedPanels: [],
              imageSize: { width: 1024, height: 576, aspectRatio: '16:9' }
            })
          }
        );

        // 加载项目数据
        await apiCall(
          '加载项目数据',
          `${API_BASE_URL}/project-storage-working?projectId=${projectId}`
        );

        // 清理测试项目
        await apiCall(
          '清理测试项目（存储）',
          `${API_BASE_URL}/projects?projectId=${projectId}`,
          { method: 'DELETE' }
        );
      }
    } catch (error) {
      console.error('项目存储测试失败:', error.message);
    }
  },

  // 4. 漫画生成测试
  async mangaGeneration() {
    try {
      // 创建测试项目
      const newProject = await apiCall(
        '创建测试项目（生成）',
        `${API_BASE_URL}/projects`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: `生成测试项目-${Date.now()}`,
            story: '在古代中国，一位年轻的武者开始了他的修炼之路...',
            style: 'manga'
          })
        }
      );

      if (newProject.success && newProject.project) {
        const projectId = newProject.project.id;

        // 测试故事分析
        await apiCall(
          '故事分析',
          `${API_BASE_URL}/manga-generation/analyze-story`,
          {
            method: 'POST',
            body: JSON.stringify({
              projectId: projectId,
              story: newProject.project.story,
              style: 'manga',
              language: 'zh'
            })
          }
        );

        // 测试角色生成
        await apiCall(
          '角色生成',
          `${API_BASE_URL}/manga-generation/generate-character`,
          {
            method: 'POST',
            body: JSON.stringify({
              projectId: projectId,
              characterName: '主角',
              description: '年轻的武者，黑发，穿着简朴的武服',
              style: 'manga'
            })
          }
        );

        // 清理测试项目
        await apiCall(
          '清理测试项目（生成）',
          `${API_BASE_URL}/projects?projectId=${projectId}`,
          { method: 'DELETE' }
        );
      }
    } catch (error) {
      console.error('漫画生成测试失败:', error.message);
    }
  },

  // 5. 分享功能测试
  async sharing() {
    try {
      // 获取公开画廊
      await apiCall(
        '获取公开画廊',
        `${API_BASE_URL}/sharing/gallery?page=1&limit=5`
      );

      // 注意：发布和取消发布需要实际的项目，这里只测试读取功能
      console.log('ℹ️  分享功能的写操作需要实际项目，跳过测试');
    } catch (error) {
      console.error('分享功能测试失败:', error.message);
    }
  }
};

// 运行所有测试
const runAllTests = async () => {
  console.log('🧪 开始 API 端点测试...\n');
  console.log(`📍 API 基础 URL: ${API_BASE_URL}`);
  console.log(`🔑 使用设备 ID: ${DEVICE_ID}\n`);

  const testNames = Object.keys(tests);
  let passedTests = 0;
  let totalTests = 0;

  for (const testName of testNames) {
    console.log(`\n🔍 运行测试: ${testName}`);
    console.log('─'.repeat(50));
    
    try {
      await tests[testName]();
      passedTests++;
    } catch (error) {
      console.error(`❌ 测试 ${testName} 失败:`, error.message);
    }
    
    totalTests++;
  }

  // 生成测试报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试报告');
  console.log('='.repeat(60));
  
  const successfulResults = testResults.filter(r => r.success);
  const failedResults = testResults.filter(r => !r.success);
  
  console.log(`✅ 成功: ${successfulResults.length}`);
  console.log(`❌ 失败: ${failedResults.length}`);
  console.log(`📈 成功率: ${Math.round((successfulResults.length / testResults.length) * 100)}%`);
  
  if (failedResults.length > 0) {
    console.log('\n❌ 失败的测试:');
    failedResults.forEach(result => {
      console.log(`   - ${result.test}: ${result.message}`);
    });
  }

  // 保存测试报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.length,
      passed: successfulResults.length,
      failed: failedResults.length,
      successRate: Math.round((successfulResults.length / testResults.length) * 100)
    },
    results: testResults
  };

  fs.writeFileSync('api-test-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 详细报告已保存到: api-test-report.json');
  
  console.log('\n🎯 测试完成！');
};

// 运行测试
runAllTests().catch(error => {
  console.error('❌ 测试运行失败:', error);
  process.exit(1);
});
