#!/usr/bin/env node

/**
 * 测试云优先存储架构
 */

const BASE_URL = 'http://localhost:8001';

// 测试数据
const testPanel = {
  panelNumber: 1,
  description: "测试面板描述",
  characters: ["测试角色"],
  dialogue: "这是一个测试对话",
  sceneDescription: "测试场景描述",
  cameraAngle: "medium shot",
  visualMood: "cheerful"
};

const testCharacterReferences = [
  {
    name: "测试角色",
    description: "一个用于测试的角色",
    appearance: "年轻人，黑发，友善的笑容"
  }
];

// 生成测试用的base64图片数据（1x1像素的透明PNG）
const testImageData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==";

async function testDeviceFingerprint() {
  console.log('\n=== 测试设备指纹生成 ===');
  
  try {
    const response = await fetch(`${BASE_URL}/api/test-device-fingerprint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAgent: 'Test-Agent/1.0',
        language: 'zh-CN'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ 设备指纹生成成功:', result);
      return result.deviceId;
    } else {
      console.log('❌ 设备指纹生成失败:', response.status);
      return null;
    }
  } catch (error) {
    console.log('❌ 设备指纹测试出错:', error.message);
    return null;
  }
}

async function testPanelSave(projectId, deviceId) {
  console.log('\n=== 测试面板保存到云端 ===');
  
  try {
    const response = await fetch(`${BASE_URL}/api/storage/panel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': deviceId
      },
      body: JSON.stringify({
        userId: deviceId,
        projectId: projectId,
        panelNumber: 1,
        imageData: testImageData,
        metadata: {
          generatedAt: new Date().toISOString(),
          userType: 'anonymous',
          testData: true
        }
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ 面板保存成功:', result);
      return result.url;
    } else {
      const error = await response.json();
      console.log('❌ 面板保存失败:', response.status, error);
      return null;
    }
  } catch (error) {
    console.log('❌ 面板保存测试出错:', error.message);
    return null;
  }
}

async function testPanelRetrieve(projectId, deviceId) {
  console.log('\n=== 测试面板从云端获取 ===');
  
  try {
    const response = await fetch(`${BASE_URL}/api/storage/panel?userId=${deviceId}&projectId=${projectId}&panelNumber=1`, {
      method: 'GET',
      headers: {
        'X-Device-ID': deviceId
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ 面板获取成功:', {
        success: result.success,
        panelNumber: result.panelNumber,
        hasImageData: !!result.imageData,
        imageDataLength: result.imageData ? result.imageData.length : 0
      });
      return true;
    } else {
      const error = await response.json();
      console.log('❌ 面板获取失败:', response.status, error);
      return false;
    }
  } catch (error) {
    console.log('❌ 面板获取测试出错:', error.message);
    return false;
  }
}

async function testBatchPanelSave(projectId, deviceId) {
  console.log('\n=== 测试批量面板保存 ===');
  
  const panels = [
    {
      panelNumber: 2,
      imageData: testImageData,
      metadata: {
        generatedAt: new Date().toISOString(),
        userType: 'anonymous',
        testData: true,
        batchTest: true
      }
    },
    {
      panelNumber: 3,
      imageData: testImageData,
      metadata: {
        generatedAt: new Date().toISOString(),
        userType: 'anonymous',
        testData: true,
        batchTest: true
      }
    }
  ];

  try {
    const response = await fetch(`${BASE_URL}/api/storage/panels-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': deviceId
      },
      body: JSON.stringify({
        userId: deviceId,
        projectId: projectId,
        panels: panels
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ 批量面板保存成功:', {
        success: result.success,
        totalPanels: result.summary?.total,
        successCount: result.summary?.success,
        failureCount: result.summary?.failures
      });
      return true;
    } else {
      const error = await response.json();
      console.log('❌ 批量面板保存失败:', response.status, error);
      return false;
    }
  } catch (error) {
    console.log('❌ 批量面板保存测试出错:', error.message);
    return false;
  }
}

async function testGeneratePanelWithCloudSave() {
  console.log('\n=== 测试面板生成并自动保存到云端 ===');
  
  const projectId = `test-project-${Date.now()}`;
  
  try {
    const response = await fetch(`${BASE_URL}/api/generate-panel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        panel: testPanel,
        characterReferences: testCharacterReferences,
        setting: "测试环境",
        style: "manga",
        language: "zh",
        aiModel: "auto",
        projectId: projectId // 新增的项目ID参数
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ 面板生成并保存成功:', {
        success: result.success,
        panelNumber: result.generatedPanel?.panelNumber,
        hasImage: !!result.generatedPanel?.image,
        hasCloudUrl: !!result.generatedPanel?.cloudUrl,
        cloudUrl: result.generatedPanel?.cloudUrl
      });
      return true;
    } else {
      const error = await response.json();
      console.log('❌ 面板生成失败:', response.status, error);
      return false;
    }
  } catch (error) {
    console.log('❌ 面板生成测试出错:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 开始测试云优先存储架构...');
  
  const projectId = `test-project-${Date.now()}`;
  console.log(`📁 使用测试项目ID: ${projectId}`);
  
  // 生成测试设备ID
  const deviceId = `anon_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`📱 使用测试设备ID: ${deviceId}`);
  
  let passedTests = 0;
  let totalTests = 0;
  
  // 测试1: 面板保存
  totalTests++;
  const saveResult = await testPanelSave(projectId, deviceId);
  if (saveResult) passedTests++;
  
  // 测试2: 面板获取
  totalTests++;
  const retrieveResult = await testPanelRetrieve(projectId, deviceId);
  if (retrieveResult) passedTests++;
  
  // 测试3: 批量面板保存
  totalTests++;
  const batchResult = await testBatchPanelSave(projectId, deviceId);
  if (batchResult) passedTests++;
  
  // 测试4: 面板生成并自动保存
  totalTests++;
  const generateResult = await testGeneratePanelWithCloudSave();
  if (generateResult) passedTests++;
  
  // 测试结果总结
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果总结:');
  console.log(`✅ 通过测试: ${passedTests}/${totalTests}`);
  console.log(`❌ 失败测试: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！云优先存储架构工作正常。');
  } else {
    console.log('⚠️  部分测试失败，请检查配置和实现。');
  }
  
  console.log('\n💡 提示: 请检查 Cloudflare R2 控制台确认文件是否正确上传。');
}

// 运行测试
runTests().catch(console.error);
