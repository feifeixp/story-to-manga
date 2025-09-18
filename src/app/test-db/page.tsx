'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ComicService } from '@/lib/services/comicService';

export default function TestDBPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setResult('Testing connection...');

    try {
      // 测试基本连接
      const { data, error } = await supabase
        .from('comics')
        .select('id')
        .limit(1);

      if (error) {
        setResult(`❌ Connection failed: ${error.message}`);
      } else {
        setResult(`✅ Connection successful! Database is accessible.`);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testTables = async () => {
    setLoading(true);
    setResult('Testing tables...');

    try {
      const tables = [
        { name: 'profiles', columns: 'id' },
        { name: 'comics', columns: 'id' },
        { name: 'comic_panels', columns: 'id' },
        { name: 'comic_likes', columns: 'id' },
        { name: 'comic_favorites', columns: 'id' },
        { name: 'comic_views', columns: 'id' }
      ];
      const results = [];

      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table.name)
            .select(table.columns)
            .limit(1);

          if (error) {
            results.push(`❌ ${table.name}: ${error.message}`);
          } else {
            results.push(`✅ ${table.name}: OK`);
          }
        } catch (error) {
          results.push(`❌ ${table.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      setResult(results.join('\n'));
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testAuth = async () => {
    setLoading(true);
    setResult('Testing authentication...');
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        setResult(`❌ Auth error: ${error.message}`);
      } else if (user) {
        setResult(`✅ User authenticated: ${user.email} (ID: ${user.id})`);
      } else {
        setResult(`ℹ️ No user currently logged in`);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testEnvironment = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    setResult(`Environment Variables:
📍 SUPABASE_URL: ${url ? '✅ Set' : '❌ Missing'}
🔑 SUPABASE_ANON_KEY: ${key ? '✅ Set' : '❌ Missing'}

URL: ${url || 'Not set'}
Key: ${key ? `${key.substring(0, 20)}...` : 'Not set'}`);
  };

  const testComicCreation = async () => {
    setLoading(true);
    setResult('Testing comic creation...');

    try {
      // 首先检查用户是否登录
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setResult('❌ Please login first to test comic creation');
        return;
      }

      // 创建测试漫画数据
      const testComicData = {
        title: 'Test Comic',
        description: 'This is a test comic created for debugging',
        style: 'manga',
        tags: ['test', 'debug'],
        panels: [
          {
            panel_number: 1,
            image_url: 'https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=Panel+1',
            text_content: 'Test panel 1'
          },
          {
            panel_number: 2,
            image_url: 'https://via.placeholder.com/400x600/4ECDC4/FFFFFF?text=Panel+2',
            text_content: 'Test panel 2'
          }
        ],
        is_published: false
      };

      const result = await ComicService.createComic(
        testComicData,
        user.id,
        user.email || 'Test User',
        user.user_metadata?.avatar_url
      );

      if (result.success) {
        setResult(`✅ Comic creation successful!
Comic ID: ${result.data?.id}
Title: ${result.data?.title}
Panels: ${result.data?.total_panels}`);
      } else {
        setResult(`❌ Comic creation failed: ${result.error}`);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">数据库连接测试</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">测试选项</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <button
              onClick={testEnvironment}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              disabled={loading}
            >
              环境变量
            </button>
            <button
              onClick={testConnection}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              disabled={loading}
            >
              连接测试
            </button>
            <button
              onClick={testTables}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
              disabled={loading}
            >
              表结构测试
            </button>
            <button
              onClick={testAuth}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
              disabled={loading}
            >
              认证测试
            </button>
            <button
              onClick={testComicCreation}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              disabled={loading}
            >
              分享测试
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

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">使用说明</h3>
          <ul className="text-yellow-700 space-y-1">
            <li>1. 首先点击"环境变量"检查配置是否正确</li>
            <li>2. 然后点击"连接测试"验证 Supabase 连接</li>
            <li>3. 点击"表结构测试"检查所有必要的表是否存在</li>
            <li>4. 最后点击"认证测试"检查用户登录状态</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
