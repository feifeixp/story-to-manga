"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StorageManager } from '@/lib/storageManager';
import { Trash2, HardDrive, AlertTriangle, CheckCircle, Database } from 'lucide-react';

interface StorageInfo {
  used: number;
  available: number;
  percentage: number;
  items: Array<{ key: string; size: number }>;
}

interface MemoryStorageStatus {
  usingMemoryStorage: boolean;
  memoryItems: number;
}

export function StorageCleanupTool() {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [memoryStorageStatus, setMemoryStorageStatus] = useState<MemoryStorageStatus>({
    usingMemoryStorage: false,
    memoryItems: 0
  });

  // 刷新存储信息
  const refreshStorageInfo = () => {
    if (typeof window !== 'undefined') {
      const info = StorageManager.getStorageInfo();
      setStorageInfo(info);
    }
  };

  useEffect(() => {
    refreshStorageInfo();
  }, []);

  // 执行清理
  const handleCleanup = async () => {
    setIsCleaningUp(true);
    setCleanupResult(null);

    try {
      const beforeInfo = StorageManager.getStorageInfo();
      StorageManager.performCleanup();
      
      // 等待一下让清理完成
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const afterInfo = StorageManager.getStorageInfo();
      const savedSpace = beforeInfo.used - afterInfo.used;
      
      setCleanupResult(`清理完成！释放了 ${(savedSpace / 1024).toFixed(1)}KB 空间`);
      refreshStorageInfo();
    } catch (error) {
      setCleanupResult('清理过程中出现错误');
      console.error('Cleanup error:', error);
    } finally {
      setIsCleaningUp(false);
    }
  };

  // 紧急清理
  const handleEmergencyCleanup = async () => {
    setIsCleaningUp(true);
    setCleanupResult(null);

    try {
      const beforeInfo = StorageManager.getStorageInfo();
      StorageManager.emergencyCleanup();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const afterInfo = StorageManager.getStorageInfo();
      const savedSpace = beforeInfo.used - afterInfo.used;
      
      setCleanupResult(`紧急清理完成！释放了 ${(savedSpace / 1024).toFixed(1)}KB 空间`);
      refreshStorageInfo();
    } catch (error) {
      setCleanupResult('紧急清理过程中出现错误');
      console.error('Emergency cleanup error:', error);
    } finally {
      setIsCleaningUp(false);
    }
  };

  if (!storageInfo) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            正在加载存储信息...
          </div>
        </CardContent>
      </Card>
    );
  }

  const isNearLimit = storageInfo.percentage > 80;
  const isOverLimit = storageInfo.percentage > 95;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          存储空间管理
        </CardTitle>
        <CardDescription>
          管理浏览器本地存储空间，解决配额问题
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 存储使用情况 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>已使用空间</span>
            <span>{(storageInfo.used / 1024).toFixed(1)}KB</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                isOverLimit ? 'bg-red-500' : 
                isNearLimit ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>0KB</span>
            <span>{storageInfo.percentage.toFixed(1)}%</span>
            <span>4MB</span>
          </div>
        </div>

        {/* 警告信息 */}
        {isOverLimit && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">
              存储空间已满，可能影响应用功能
            </span>
          </div>
        )}

        {isNearLimit && !isOverLimit && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-yellow-700">
              存储空间即将用完，建议清理
            </span>
          </div>
        )}

        {/* 内存存储状态 */}
        {memoryStorageStatus.usingMemoryStorage && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Database className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-blue-700">
              正在使用内存存储 ({memoryStorageStatus.memoryItems} 项) - 认证功能正常
            </span>
          </div>
        )}

        {/* 存储项目列表 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">存储项目 ({storageInfo.items.length})</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {storageInfo.items.slice(0, 5).map((item, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="truncate flex-1 mr-2" title={item.key}>
                  {item.key}
                </span>
                <span className="text-gray-500">
                  {(item.size / 1024).toFixed(1)}KB
                </span>
              </div>
            ))}
            {storageInfo.items.length > 5 && (
              <div className="text-xs text-gray-400 text-center">
                还有 {storageInfo.items.length - 5} 个项目...
              </div>
            )}
          </div>
        </div>

        {/* 清理结果 */}
        {cleanupResult && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-700">{cleanupResult}</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="space-y-2">
          <Button
            onClick={handleCleanup}
            disabled={isCleaningUp}
            className="w-full"
            variant={isNearLimit ? "default" : "outline"}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isCleaningUp ? '清理中...' : '清理过期数据'}
          </Button>
          
          {isOverLimit && (
            <Button
              onClick={handleEmergencyCleanup}
              disabled={isCleaningUp}
              className="w-full"
              variant="destructive"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              {isCleaningUp ? '紧急清理中...' : '紧急清理'}
            </Button>
          )}
          
          <Button
            onClick={refreshStorageInfo}
            disabled={isCleaningUp}
            className="w-full"
            variant="ghost"
            size="sm"
          >
            刷新信息
          </Button>
        </div>

        {/* 提示信息 */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• 清理过期数据：删除过期的认证令牌和临时数据</p>
          <p>• 紧急清理：删除大部分非关键数据以释放空间</p>
          <p>• 重要数据（如设备ID）会被保护</p>
          <p>• 配额超限时自动使用内存存储，确保登录功能正常</p>
        </div>
      </CardContent>
    </Card>
  );
}
