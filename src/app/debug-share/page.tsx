'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ComicService } from '@/lib/services/comicService';

export default function DebugSharePage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testBasicConnection = async () => {
    setLoading(true);
    setResult('Testing basic Supabase connection...');
    
    try {
      // 最简单的连接测试
      const { data, error } = await supabase
        .from('comics')
        .select('*')
        .limit(1);
      
      if (error) {
        setResult(`❌ Connection failed: ${error.message}\n\nError details: ${JSON.stringify(error, null, 2)}`);
      } else {
        setResult(`✅ Connection successful!\nFound ${data?.length || 0} comics in database.`);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testUserAuth = async () => {
    setLoading(true);
    setResult('Testing user authentication...');
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        setResult(`❌ Auth error: ${error.message}`);
      } else if (user) {
        setResult(`✅ User authenticated:
Email: ${user.email}
ID: ${user.id}
Name: ${user.user_metadata?.name || 'Not set'}
Created: ${user.created_at}`);
      } else {
        setResult(`ℹ️ No user currently logged in. Please login first.`);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testProfileSetup = async () => {
    setLoading(true);
    setResult('Testing profile setup...');

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setResult('❌ Please login first');
        return;
      }

      // 检查 profiles 表中是否存在用户记录
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // 用户不存在，创建 profile
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.avatar_url,
            bio: null
          })
          .select()
          .single();

        if (createError) {
          setResult(`❌ Failed to create profile: ${createError.message}\n\nError details: ${JSON.stringify(createError, null, 2)}`);
        } else {
          setResult(`✅ Profile created successfully!
ID: ${newProfile.id}
Name: ${newProfile.name}
Avatar: ${newProfile.avatar_url || 'Not set'}
Created: ${newProfile.created_at}`);
        }
      } else if (profileError) {
        setResult(`❌ Profile check failed: ${profileError.message}\n\nError details: ${JSON.stringify(profileError, null, 2)}`);
      } else {
        setResult(`✅ Profile already exists!
ID: ${profile.id}
Name: ${profile.name}
Avatar: ${profile.avatar_url || 'Not set'}
Bio: ${profile.bio || 'Not set'}
Created: ${profile.created_at}
Updated: ${profile.updated_at}`);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testCreateComic = async () => {
    setLoading(true);
    setResult('Testing comic creation...');
    
    try {
      // 检查用户登录状态
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setResult('❌ Please login first to test comic creation');
        return;
      }

      console.log('🔍 Starting comic creation test...');
      console.log('User:', user);

      // 创建最简单的测试数据
      const testData = {
        title: `Test Comic ${Date.now()}`,
        description: 'This is a test comic for debugging',
        style: 'manga',
        tags: ['test'],
        panels: [
          {
            panel_number: 1,
            image_url: 'https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=Test+Panel+1',
            text_content: 'Test panel content'
          }
        ],
        is_published: false
      };

      console.log('📝 Test data:', testData);

      const result = await ComicService.createComic(
        testData,
        user.id,
        user.email || 'Test User'
      );

      console.log('📊 Result:', result);

      if (result.success) {
        setResult(`✅ Comic creation successful!
Comic ID: ${result.data?.id}
Title: ${result.data?.title}
Author: ${result.data?.author_name}
Panels: ${result.data?.total_panels}
Published: ${result.data?.is_published ? 'Yes' : 'No'}`);
      } else {
        setResult(`❌ Comic creation failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Test error:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testDirectInsert = async () => {
    setLoading(true);
    setResult('Testing direct database insert...');

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setResult('❌ Please login first');
        return;
      }

      // 首先检查用户是否在 profiles 表中存在
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // 用户不存在于 profiles 表，需要创建
        setResult('⚠️ User profile not found, creating profile...');

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.avatar_url
          })
          .select()
          .single();

        if (createError) {
          setResult(`❌ Failed to create profile: ${createError.message}\n\nError details: ${JSON.stringify(createError, null, 2)}`);
          return;
        }

        setResult(`✅ Profile created successfully! Now testing comic insert...`);
      } else if (profileError) {
        setResult(`❌ Profile check failed: ${profileError.message}\n\nError details: ${JSON.stringify(profileError, null, 2)}`);
        return;
      } else {
        setResult(`✅ Profile exists: ${profile.name || profile.id}`);
      }

      // 现在尝试插入漫画
      const { data, error } = await supabase
        .from('comics')
        .insert({
          title: `Direct Test ${Date.now()}`,
          description: 'Direct insert test',
          author_id: user.id,
          author_name: profile?.name || user.email || 'Test User',
          style: 'manga',
          tags: ['direct-test'],
          total_panels: 1,
          is_published: false
        })
        .select()
        .single();

      if (error) {
        setResult(`❌ Direct insert failed: ${error.message}\n\nError details: ${JSON.stringify(error, null, 2)}`);
      } else {
        setResult(`✅ Direct insert successful!
Comic ID: ${data.id}
Title: ${data.title}
Author: ${data.author_name}
Profile: ${profile?.name || 'Created automatically'}`);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">分享功能调试</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">调试测试</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <button
              onClick={testBasicConnection}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              disabled={loading}
            >
              基础连接
            </button>
            <button
              onClick={testUserAuth}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              disabled={loading}
            >
              用户认证
            </button>
            <button
              onClick={testProfileSetup}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
              disabled={loading}
            >
              Profile设置
            </button>
            <button
              onClick={testDirectInsert}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
              disabled={loading}
            >
              直接插入
            </button>
            <button
              onClick={testCreateComic}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              disabled={loading}
            >
              完整测试
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">测试结果</h2>
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
              <span>测试中...</span>
            </div>
          ) : (
            <pre className="bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap font-mono">
              {result || '点击上方按钮开始测试'}
            </pre>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">测试说明</h3>
          <ul className="text-blue-700 space-y-1">
            <li>1. <strong>基础连接</strong>: 测试 Supabase 数据库连接</li>
            <li>2. <strong>用户认证</strong>: 检查当前用户登录状态</li>
            <li>3. <strong>Profile设置</strong>: 检查/创建用户 Profile 记录</li>
            <li>4. <strong>直接插入</strong>: 直接向 comics 表插入数据</li>
            <li>5. <strong>完整测试</strong>: 使用 ComicService 创建漫画</li>
          </ul>
        </div>

        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">注意事项</h3>
          <ul className="text-yellow-700 space-y-1">
            <li>• 请先在首页登录用户账户</li>
            <li>• 打开浏览器开发者工具查看详细日志</li>
            <li>• 如果测试失败，请检查 Supabase 数据库设置</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
