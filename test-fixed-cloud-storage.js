/**
 * 测试修复后的云存储功能
 * 验证图片是否正确保存到 Cloudflare R2
 */

const { getR2Client } = require('./src/lib/r2Storage.ts');

// 测试配置
const TEST_CONFIG = {
  userId: 'test_user_123',
  projectId: 'test_project_456',
  panelNumber: 1,
  testImageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA=='
};

async function testR2Upload() {
  console.log('🧪 Testing R2 Upload Functionality...\n');
  
  try {
    // 检查环境变量
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      console.log('❌ Missing R2 credentials in environment variables');
      return false;
    }
    
    console.log('✅ R2 credentials found');
    console.log(`   Access Key ID: ${process.env.R2_ACCESS_KEY_ID.substring(0, 8)}...`);
    console.log(`   Endpoint: ${process.env.R2_ENDPOINT || 'default'}`);
    console.log(`   Bucket: ${process.env.R2_BUCKET_NAME || 'mangashare'}\n`);
    
    // 获取 R2 客户端
    const r2Client = getR2Client();
    console.log('✅ R2 client initialized\n');
    
    // 测试连接
    console.log('🔗 Testing R2 connection...');
    const connectionTest = await r2Client.testConnection();
    if (!connectionTest) {
      console.log('❌ R2 connection failed');
      return false;
    }
    console.log('✅ R2 connection successful\n');
    
    // 构建测试文件路径
    const filePath = `${TEST_CONFIG.userId}/projects/${TEST_CONFIG.projectId}/panels/panel_${TEST_CONFIG.panelNumber}.jpg`;
    console.log(`📁 Test file path: ${filePath}\n`);
    
    // 上传测试图片
    console.log('⬆️  Uploading test image...');
    const uploadResult = await r2Client.uploadFile(
      filePath,
      TEST_CONFIG.testImageData,
      {
        contentType: 'image/jpeg',
        metadata: {
          userId: TEST_CONFIG.userId,
          projectId: TEST_CONFIG.projectId,
          panelNumber: TEST_CONFIG.panelNumber.toString(),
          uploadedAt: new Date().toISOString(),
          userType: 'test',
          testUpload: 'true'
        }
      }
    );
    
    console.log('✅ Upload successful!');
    console.log(`   URL: ${uploadResult.url || 'N/A'}`);
    console.log(`   Key: ${uploadResult.key || filePath}\n`);
    
    // 验证文件存在
    console.log('🔍 Verifying file exists...');
    const fileExists = await r2Client.fileExists(filePath);
    if (!fileExists) {
      console.log('❌ File not found after upload');
      return false;
    }
    console.log('✅ File exists in R2\n');
    
    // 获取文件信息
    console.log('📊 Getting file info...');
    const fileInfo = await r2Client.getFileInfo(filePath);
    if (fileInfo) {
      console.log('✅ File info retrieved:');
      console.log(`   Size: ${fileInfo.size} bytes`);
      console.log(`   Content Type: ${fileInfo.contentType}`);
      console.log(`   Last Modified: ${fileInfo.lastModified}`);
      console.log(`   Metadata: ${JSON.stringify(fileInfo.metadata, null, 2)}\n`);
    } else {
      console.log('⚠️  Could not retrieve file info\n');
    }
    
    // 清理测试文件
    console.log('🧹 Cleaning up test file...');
    await r2Client.deleteFile(filePath);
    console.log('✅ Test file deleted\n');
    
    console.log('🎉 All tests passed! R2 storage is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

async function testCloudFirstStorage() {
  console.log('\n🧪 Testing CloudFirst Storage Integration...\n');
  
  try {
    // 动态导入 CloudFirst 存储
    const { CloudFirstStorage } = await import('./src/lib/cloudFirst.ts');
    
    // 创建存储实例
    const cloudStorage = new CloudFirstStorage();
    await cloudStorage.initialize();
    console.log('✅ CloudFirst storage initialized\n');
    
    // 测试保存面板
    console.log('💾 Testing panel save...');
    const panelUrl = await cloudStorage.saveGeneratedPanel(
      TEST_CONFIG.projectId,
      TEST_CONFIG.panelNumber,
      TEST_CONFIG.testImageData,
      { testPanel: true }
    );
    
    console.log('✅ Panel saved successfully!');
    console.log(`   URL: ${panelUrl}\n`);
    
    // 测试批量保存
    console.log('📦 Testing batch panel save...');
    const batchResults = await cloudStorage.saveGeneratedPanels(
      TEST_CONFIG.projectId,
      [
        {
          panelNumber: 2,
          imageData: TEST_CONFIG.testImageData,
          metadata: { testBatch: true, panelIndex: 0 }
        },
        {
          panelNumber: 3,
          imageData: TEST_CONFIG.testImageData,
          metadata: { testBatch: true, panelIndex: 1 }
        }
      ]
    );
    
    console.log('✅ Batch save successful!');
    console.log(`   Saved ${batchResults.length} panels`);
    batchResults.forEach((result, index) => {
      console.log(`   Panel ${result.panelNumber}: ${result.url}`);
    });
    
    console.log('\n🎉 CloudFirst storage integration test passed!');
    return true;
    
  } catch (error) {
    console.error('❌ CloudFirst storage test failed:', error);
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 Starting Cloud Storage Tests...\n');
  
  const r2Test = await testR2Upload();
  const cloudFirstTest = await testCloudFirstStorage();
  
  console.log('\n📋 Test Results Summary:');
  console.log(`   R2 Storage: ${r2Test ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   CloudFirst Integration: ${cloudFirstTest ? '✅ PASS' : '❌ FAIL'}`);
  
  if (r2Test && cloudFirstTest) {
    console.log('\n🎉 All tests passed! Cloud storage is working correctly.');
    console.log('   Your generated images should now be automatically saved to Cloudflare R2.');
  } else {
    console.log('\n❌ Some tests failed. Please check the error messages above.');
  }
}

// 运行测试
runAllTests().catch(console.error);
