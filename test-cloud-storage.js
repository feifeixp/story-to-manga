#!/usr/bin/env node

/**
 * 测试云端存储功能
 * 验证生成的面板是否正确保存到 Cloudflare R2
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:8001';

async function testCloudStorage() {
  console.log('🧪 开始测试云端存储功能...\n');

  try {
    // 1. 测试单个面板生成和云端保存
    console.log('📝 测试单个面板生成...');
    const panelResponse = await fetch(`${API_BASE}/api/generate-panel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        panel: {
          description: '测试面板描述',
          panelDescription: '一个简单的测试面板',
          sceneDescription: '测试场景',
          panelNumber: 1,
          characters: ['测试角色'],
          dialogue: '这是测试对话',
          cameraAngle: 'medium shot',
          visualMood: 'neutral',
        },
        characterReferences: [
          {
            name: '测试角色',
            imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA=='
          }
        ],
        setting: '测试设置',
        style: 'manga',
        language: 'zh',
        aiModel: 'auto',
        imageSize: 'square',
        projectId: 'test-project-' + Date.now(), // 关键：提供项目ID以启用云端保存
      }),
    });

    if (!panelResponse.ok) {
      throw new Error(`面板生成失败: ${panelResponse.status} ${panelResponse.statusText}`);
    }

    const panelResult = await panelResponse.json();
    console.log('✅ 面板生成成功');
    console.log(`   - 面板编号: ${panelResult.panelNumber}`);
    console.log(`   - 云端URL: ${panelResult.cloudUrl || '❌ 未保存到云端'}`);
    console.log(`   - 图片数据: ${panelResult.imageData ? '✅ 存在' : '❌ 缺失'}`);

    if (panelResult.cloudUrl) {
      console.log('🎉 云端保存成功！');
      
      // 2. 测试从云端获取面板
      console.log('\n📥 测试从云端获取面板...');
      const userId = panelResult.cloudUrl.includes('anon_') ? 
        panelResult.cloudUrl.match(/anon_[a-z0-9_]+/)[0] : 'test-user';
      const projectId = panelResult.cloudUrl.match(/projects\/([^\/]+)/)[1];
      
      const getResponse = await fetch(
        `${API_BASE}/api/storage/panel?userId=${userId}&projectId=${projectId}&panelNumber=1`
      );
      
      if (getResponse.ok) {
        const retrievedPanel = await getResponse.json();
        console.log('✅ 从云端获取面板成功');
        console.log(`   - 面板编号: ${retrievedPanel.panelNumber}`);
        console.log(`   - 文件大小: ${retrievedPanel.size} 字节`);
      } else {
        console.log('❌ 从云端获取面板失败:', getResponse.status);
      }
    } else {
      console.log('❌ 云端保存失败 - 检查日志以了解详情');
    }

    // 3. 测试批量面板生成
    console.log('\n📝 测试批量面板生成...');
    const batchResponse = await fetch(`${API_BASE}/api/generate-panels-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        panels: [
          {
            description: '批量测试面板1',
            panelNumber: 2,
            characters: ['测试角色'],
            dialogue: '批量测试对话1',
          },
          {
            description: '批量测试面板2',
            panelNumber: 3,
            characters: ['测试角色'],
            dialogue: '批量测试对话2',
          }
        ],
        characterReferences: [
          {
            name: '测试角色',
            imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA=='
          }
        ],
        setting: '批量测试设置',
        style: 'manga',
        language: 'zh',
        aiModel: 'auto',
        imageSize: 'square',
        batchSize: 2,
        projectId: 'test-batch-project-' + Date.now(), // 关键：提供项目ID
      }),
    });

    if (!batchResponse.ok) {
      throw new Error(`批量生成失败: ${batchResponse.status} ${batchResponse.statusText}`);
    }

    const batchResult = await batchResponse.json();
    console.log('✅ 批量生成成功');
    console.log(`   - 成功面板数: ${batchResult.results.filter(r => r.success).length}`);
    console.log(`   - 失败面板数: ${batchResult.results.filter(r => !r.success).length}`);
    
    const cloudSavedCount = batchResult.results.filter(r => r.cloudUrl).length;
    console.log(`   - 云端保存数: ${cloudSavedCount}`);

    if (cloudSavedCount > 0) {
      console.log('🎉 批量云端保存成功！');
    } else {
      console.log('❌ 批量云端保存失败');
    }

    console.log('\n🎯 测试总结:');
    console.log(`   - 单个面板云端保存: ${panelResult.cloudUrl ? '✅' : '❌'}`);
    console.log(`   - 批量面板云端保存: ${cloudSavedCount > 0 ? '✅' : '❌'}`);
    
    if (panelResult.cloudUrl || cloudSavedCount > 0) {
      console.log('\n🚀 云端存储功能正常工作！');
      console.log('   用户生成的所有内容都会自动保存到 Cloudflare R2');
    } else {
      console.log('\n⚠️  云端存储功能需要检查');
      console.log('   请查看服务器日志以了解详细错误信息');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
testCloudStorage();
