/**
 * 云存储功能测试脚本
 * 
 * 使用方法:
 * 1. 确保已设置环境变量 R2_ACCESS_KEY_ID 和 R2_SECRET_ACCESS_KEY
 * 2. 运行: node tests/test-cloud-storage.js
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// 测试配置
const TEST_CONFIG = {
  endpoint: 'https://fac7207421271dd5183fcab70164cad1.r2.cloudflarestorage.com',
  bucket: 'mangashare',
  region: 'auto',
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
};

// 测试数据
const TEST_DATA = {
  testFile: 'test-file.txt',
  testContent: 'Hello, Cloudflare R2! This is a test file.',
  testImage: 'test-image.jpg',
  testImageContent: Buffer.from('fake-image-data'),
};

class CloudStorageTest {
  constructor() {
    this.s3Client = new S3Client({
      region: TEST_CONFIG.region,
      endpoint: TEST_CONFIG.endpoint,
      credentials: {
        accessKeyId: TEST_CONFIG.accessKeyId,
        secretAccessKey: TEST_CONFIG.secretAccessKey,
      },
      forcePathStyle: true,
    });
    
    this.testResults = [];
  }

  // 记录测试结果
  logResult(testName, success, message = '') {
    const result = {
      test: testName,
      success,
      message,
      timestamp: new Date().toISOString(),
    };
    
    this.testResults.push(result);
    
    const status = success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}${message ? ': ' + message : ''}`);
  }

  // 测试基本连接
  async testConnection() {
    try {
      // 尝试列出存储桶内容（限制1个对象）
      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: TEST_CONFIG.bucket,
        MaxKeys: 1,
      });
      
      await this.s3Client.send(command);
      this.logResult('Connection Test', true, 'Successfully connected to R2');
      return true;
    } catch (error) {
      this.logResult('Connection Test', false, error.message);
      return false;
    }
  }

  // 测试文件上传
  async testUpload() {
    try {
      const command = new PutObjectCommand({
        Bucket: TEST_CONFIG.bucket,
        Key: `test/${TEST_DATA.testFile}`,
        Body: TEST_DATA.testContent,
        ContentType: 'text/plain',
        Metadata: {
          'test': 'true',
          'uploadedAt': new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);
      this.logResult('File Upload Test', true, 'Text file uploaded successfully');
      return true;
    } catch (error) {
      this.logResult('File Upload Test', false, error.message);
      return false;
    }
  }

  // 测试图片上传
  async testImageUpload() {
    try {
      const command = new PutObjectCommand({
        Bucket: TEST_CONFIG.bucket,
        Key: `test/${TEST_DATA.testImage}`,
        Body: TEST_DATA.testImageContent,
        ContentType: 'image/jpeg',
        Metadata: {
          'test': 'true',
          'type': 'image',
          'uploadedAt': new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);
      this.logResult('Image Upload Test', true, 'Image file uploaded successfully');
      return true;
    } catch (error) {
      this.logResult('Image Upload Test', false, error.message);
      return false;
    }
  }

  // 测试文件下载
  async testDownload() {
    try {
      const command = new GetObjectCommand({
        Bucket: TEST_CONFIG.bucket,
        Key: `test/${TEST_DATA.testFile}`,
      });

      const response = await this.s3Client.send(command);
      
      // 读取响应体
      const chunks = [];
      const reader = response.Body.transformToWebStream().getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const content = Buffer.concat(chunks).toString('utf-8');
      
      if (content === TEST_DATA.testContent) {
        this.logResult('File Download Test', true, 'File content matches uploaded data');
        return true;
      } else {
        this.logResult('File Download Test', false, 'File content does not match');
        return false;
      }
    } catch (error) {
      this.logResult('File Download Test', false, error.message);
      return false;
    }
  }

  // 测试文件删除
  async testDelete() {
    try {
      // 删除文本文件
      const deleteTextCommand = new DeleteObjectCommand({
        Bucket: TEST_CONFIG.bucket,
        Key: `test/${TEST_DATA.testFile}`,
      });
      await this.s3Client.send(deleteTextCommand);

      // 删除图片文件
      const deleteImageCommand = new DeleteObjectCommand({
        Bucket: TEST_CONFIG.bucket,
        Key: `test/${TEST_DATA.testImage}`,
      });
      await this.s3Client.send(deleteImageCommand);

      this.logResult('File Delete Test', true, 'Test files deleted successfully');
      return true;
    } catch (error) {
      this.logResult('File Delete Test', false, error.message);
      return false;
    }
  }

  // 测试用户文件路径结构
  async testUserFileStructure() {
    try {
      const userId = 'test-user-123';
      const projectId = 'test-project-456';
      const fileName = 'test-project-file.json';
      
      const filePath = `users/${userId}/projects/${projectId}/${fileName}`;
      const testData = JSON.stringify({
        projectId,
        name: 'Test Project',
        createdAt: new Date().toISOString(),
      });

      // 上传测试项目文件
      const uploadCommand = new PutObjectCommand({
        Bucket: TEST_CONFIG.bucket,
        Key: filePath,
        Body: testData,
        ContentType: 'application/json',
        Metadata: {
          'userId': userId,
          'projectId': projectId,
          'type': 'project-data',
        },
      });
      await this.s3Client.send(uploadCommand);

      // 下载并验证
      const downloadCommand = new GetObjectCommand({
        Bucket: TEST_CONFIG.bucket,
        Key: filePath,
      });
      const response = await this.s3Client.send(downloadCommand);
      
      const chunks = [];
      const reader = response.Body.transformToWebStream().getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const downloadedData = Buffer.concat(chunks).toString('utf-8');
      
      // 清理测试文件
      const deleteCommand = new DeleteObjectCommand({
        Bucket: TEST_CONFIG.bucket,
        Key: filePath,
      });
      await this.s3Client.send(deleteCommand);

      if (downloadedData === testData) {
        this.logResult('User File Structure Test', true, 'User file path structure works correctly');
        return true;
      } else {
        this.logResult('User File Structure Test', false, 'Data integrity check failed');
        return false;
      }
    } catch (error) {
      this.logResult('User File Structure Test', false, error.message);
      return false;
    }
  }

  // 运行所有测试
  async runAllTests() {
    console.log('🚀 Starting Cloud Storage Tests...\n');
    
    // 检查环境变量
    if (!TEST_CONFIG.accessKeyId || !TEST_CONFIG.secretAccessKey) {
      console.log('❌ Missing R2 credentials. Please set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables.');
      return;
    }

    console.log('📋 Test Configuration:');
    console.log(`   Endpoint: ${TEST_CONFIG.endpoint}`);
    console.log(`   Bucket: ${TEST_CONFIG.bucket}`);
    console.log(`   Region: ${TEST_CONFIG.region}`);
    console.log(`   Access Key ID: ${TEST_CONFIG.accessKeyId.substring(0, 8)}...`);
    console.log('');

    const tests = [
      () => this.testConnection(),
      () => this.testUpload(),
      () => this.testImageUpload(),
      () => this.testDownload(),
      () => this.testUserFileStructure(),
      () => this.testDelete(),
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (const test of tests) {
      try {
        const result = await test();
        if (result) passedTests++;
      } catch (error) {
        console.log(`❌ Test failed with unexpected error: ${error.message}`);
      }
      
      // 添加小延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 Test Summary:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${totalTests - passedTests}`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (passedTests === totalTests) {
      console.log('\n🎉 All tests passed! Cloud storage is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the configuration and try again.');
    }

    return {
      total: totalTests,
      passed: passedTests,
      failed: totalTests - passedTests,
      results: this.testResults,
    };
  }
}

// 运行测试
if (require.main === module) {
  const tester = new CloudStorageTest();
  tester.runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = CloudStorageTest;
