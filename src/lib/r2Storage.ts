import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2存储配置接口
interface R2Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

// 文件上传选项
interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
  isPublic?: boolean;
}

// 文件信息接口
interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
}

// R2存储客户端类
export class R2StorageClient {
  private s3Client: S3Client;
  private bucket: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // Required for R2
    });
  }

  /**
   * 上传文件到R2
   */
  async uploadFile(
    key: string,
    data: Buffer | Uint8Array | string,
    options: UploadOptions = {}
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: options.metadata,
        CacheControl: options.cacheControl || 'public, max-age=3600',
        // R2不支持ACL，使用自定义元数据标记公开状态
        ...(options.isPublic && {
          Metadata: {
            ...options.metadata,
            'public': 'true'
          }
        })
      });

      await this.s3Client.send(command);
      
      // 返回文件的公开URL（如果是公开文件）
      if (options.isPublic) {
        return `https://pub-${this.bucket.replace('mangashare', '')}.r2.dev/${key}`;
      }
      
      return key; // 返回key，私有文件需要通过API访问
    } catch (error) {
      console.error('Failed to upload file to R2:', error);
      throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 从R2下载文件
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('File not found or empty');
      }

      // 将流转换为Buffer
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Failed to download file from R2:', error);
      throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Failed to delete file from R2:', error);
      throw new Error(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(key: string): Promise<FileInfo | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType,
        metadata: response.Metadata,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 列出文件
   */
  async listFiles(prefix: string, maxKeys: number = 1000): Promise<FileInfo[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.s3Client.send(command);
      
      return (response.Contents || []).map(obj => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
      }));
    } catch (error) {
      console.error('Failed to list files from R2:', error);
      throw new Error(`List failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 生成预签名URL（用于直接上传）
   */
  async generatePresignedUploadUrl(
    key: string,
    expiresIn: number = 3600,
    contentType?: string
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Failed to generate presigned upload URL:', error);
      throw new Error(`Presigned URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 生成预签名下载URL
   */
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Failed to generate presigned download URL:', error);
      throw new Error(`Presigned URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(keys: string[]): Promise<void> {
    try {
      // R2不支持批量删除，需要逐个删除
      const deletePromises = keys.map(key => this.deleteFile(key));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Failed to delete files from R2:', error);
      throw new Error(`Batch delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// 创建R2客户端实例
let r2Client: R2StorageClient | null = null;

export function getR2Client(): R2StorageClient {
  if (!r2Client) {
    const config: R2Config = {
      endpoint: 'https://fac7207421271dd5183fcab70164cad1.r2.cloudflarestorage.com',
      bucket: 'mangashare',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      region: 'auto',
    };

    // 验证配置
    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error('R2 credentials not found. Please check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables.');
    }

    r2Client = new R2StorageClient(config);
  }

  return r2Client;
}

// 工具函数：生成用户文件路径
export function generateUserFilePath(userId: string, projectId: string, fileName: string): string {
  return `users/${userId}/projects/${projectId}/${fileName}`;
}

// 工具函数：生成公开文件路径
export function generatePublicFilePath(comicId: string, fileName: string): string {
  return `public/comics/${comicId}/${fileName}`;
}

// 工具函数：从base64转换为Buffer
export function base64ToBuffer(base64: string): Buffer {
  // 移除data URL前缀
  const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

// 工具函数：获取文件扩展名
export function getFileExtension(contentType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/json': 'json',
  };
  return extensions[contentType] || 'bin';
}
