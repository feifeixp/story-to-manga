/**
 * Cloudflare R2 配置管理
 * 处理开发和生产环境的不同公开域名设置
 */

export interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  accountId: string;
  bucketName: string;
  endpoint: string;
  publicDomain: string;
}

/**
 * 获取当前环境的R2配置
 */
export function getR2Config(): R2Config {
  // 基础配置
  const config: R2Config = {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    accountId: process.env.R2_ACCOUNT_ID || '',
    bucketName: process.env.R2_BUCKET_NAME || 'mangashare',
    endpoint: process.env.R2_ENDPOINT || '',
    publicDomain: getPublicDomain(),
  };

  // 验证必需的配置
  if (!config.accessKeyId || !config.secretAccessKey || !config.accountId) {
    throw new Error('Missing required R2 configuration. Please check your environment variables.');
  }

  return config;
}

/**
 * 获取公开访问域名
 * 根据环境自动选择合适的域名
 */
export function getPublicDomain(): string {
  // 1. 优先使用明确指定的公开域名
  if (process.env.R2_PUBLIC_DOMAIN) {
    return process.env.R2_PUBLIC_DOMAIN;
  }

  // 2. 根据环境自动选择
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isProduction) {
    // 生产环境：优先使用生产域名，回退到默认域名
    return process.env.R2_PUBLIC_DOMAIN_PROD || 'https://manga.neodomain.ai';
  } else if (isDevelopment) {
    // 开发环境：优先使用开发域名
    return process.env.R2_PUBLIC_DOMAIN_DEV || process.env.R2_PUBLIC_DOMAIN_PROD || 'https://manga.neodomain.ai';
  }

  // 3. 回退到生产域名作为默认值
  return process.env.R2_PUBLIC_DOMAIN_PROD || 'https://manga.neodomain.ai';
}

/**
 * 生成公开文件URL
 */
export function generatePublicUrl(filePath: string): string {
  const publicDomain = getPublicDomain();
  
  // 确保文件路径不以斜杠开头（避免双斜杠）
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  
  // 确保域名不以斜杠结尾
  const cleanDomain = publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain;
  
  return `${cleanDomain}/${cleanPath}`;
}

/**
 * 检查URL是否为R2公开域名
 */
export function isR2PublicUrl(url: string): boolean {
  const publicDomain = getPublicDomain();
  const devDomain = process.env.R2_PUBLIC_DOMAIN_DEV;
  const prodDomain = process.env.R2_PUBLIC_DOMAIN_PROD || 'https://manga.neodomain.ai';
  
  return url.startsWith(publicDomain) || 
         (devDomain && url.startsWith(devDomain)) ||
         url.startsWith(prodDomain);
}

/**
 * 获取环境信息（用于调试）
 */
export function getEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV,
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    publicDomain: getPublicDomain(),
    availableDomains: {
      dev: process.env.R2_PUBLIC_DOMAIN_DEV,
      prod: process.env.R2_PUBLIC_DOMAIN_PROD || 'https://manga.neodomain.ai',
      current: process.env.R2_PUBLIC_DOMAIN,
    }
  };
}

/**
 * 验证R2配置是否完整
 */
export function validateR2Config(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!process.env.R2_ACCESS_KEY_ID) {
    errors.push('R2_ACCESS_KEY_ID is required');
  }
  
  if (!process.env.R2_SECRET_ACCESS_KEY) {
    errors.push('R2_SECRET_ACCESS_KEY is required');
  }
  
  if (!process.env.R2_ACCOUNT_ID) {
    errors.push('R2_ACCOUNT_ID is required');
  }
  
  if (!process.env.R2_BUCKET_NAME) {
    errors.push('R2_BUCKET_NAME is required');
  }
  
  if (!process.env.R2_ENDPOINT) {
    errors.push('R2_ENDPOINT is required');
  }
  
  const publicDomain = getPublicDomain();
  if (!publicDomain || !publicDomain.startsWith('http')) {
    errors.push('Valid R2 public domain is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
