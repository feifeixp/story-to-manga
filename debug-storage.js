// 调试存储状态的脚本
console.log('=== Storage Debug Script ===');

// 检查浏览器控制台中的存储状态
function checkStorageStatus() {
  console.log('\n1. 检查 localStorage 中的项目数据:');
  const projectList = localStorage.getItem('manga-projects-list');
  if (projectList) {
    const projects = JSON.parse(projectList);
    console.log(`找到 ${projects.length} 个项目:`, projects);
    
    // 检查每个项目的数据
    projects.forEach(project => {
      const projectData = localStorage.getItem(`manga-project-${project.metadata.id}`);
      if (projectData) {
        const data = JSON.parse(projectData);
        console.log(`项目 ${project.metadata.name} (${project.metadata.id}):`, {
          story: data.story ? `${data.story.length} 字符` : '无故事',
          panels: data.generatedPanels ? data.generatedPanels.length : 0,
          characters: data.characterReferences ? data.characterReferences.length : 0,
          timestamp: new Date(data.timestamp).toLocaleString()
        });
      }
    });
  } else {
    console.log('没有找到项目列表');
  }

  console.log('\n2. 检查当前项目ID:');
  const currentProjectId = localStorage.getItem('manga-current-project');
  console.log('当前项目ID:', currentProjectId);

  console.log('\n3. 检查 Supabase 认证状态:');
  // 这需要在浏览器控制台中运行
  console.log('请在浏览器控制台中运行以下代码来检查认证状态:');
  console.log(`
import { supabase } from '/src/lib/supabase.js';
supabase.auth.getSession().then(({ data: { session } }) => {
  console.log('认证状态:', session ? '已认证' : '未认证');
  if (session) {
    console.log('用户ID:', session.user.id);
    console.log('访问令牌:', session.access_token ? '存在' : '不存在');
  }
});
  `);

  console.log('\n4. 检查混合存储状态:');
  console.log('请在浏览器控制台中运行以下代码:');
  console.log(`
import { hybridStorage } from '/src/lib/hybridStorage.js';
console.log('是否使用云存储:', hybridStorage.isUsingCloudStorage());
  `);
}

// 测试保存功能
function testSaveFunction() {
  console.log('\n=== 测试保存功能 ===');
  console.log('请在浏览器控制台中运行以下代码来测试保存:');
  console.log(`
import { hybridStorage } from '/src/lib/hybridStorage.js';

// 创建测试项目
const testProject = await hybridStorage.createProject({
  name: '测试项目 - ' + new Date().toLocaleString(),
  description: '这是一个测试项目',
  style: 'manga'
});

console.log('创建的测试项目:', testProject);

// 保存测试数据
await hybridStorage.saveProjectData(
  testProject.id,
  '这是一个测试故事，用来验证保存功能是否正常工作。',
  'manga',
  null, // storyAnalysis
  null, // storyBreakdown
  [], // characterReferences
  [], // generatedPanels
  [], // uploadedCharacterReferences
  [], // uploadedSettingReferences
);

console.log('测试数据已保存');
  `);
}

// 运行检查
checkStorageStatus();
testSaveFunction();

console.log('\n=== 使用说明 ===');
console.log('1. 打开浏览器开发者工具');
console.log('2. 进入 Console 标签');
console.log('3. 复制并运行上面显示的代码片段');
console.log('4. 查看输出结果');
