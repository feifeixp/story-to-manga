'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initI18n } from '@/lib/i18n';
import type { i18n } from 'i18next';

interface I18nContextType {
  t: (key: string, options?: any) => string;
  i18n: i18n | null;
  setLocale: (locale: string) => void;
  locale: string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [locale, setLocaleState] = useState('en');
  const [i18nInstance, setI18nInstance] = useState<i18n | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        const i18n = await initI18n();
        setI18nInstance(i18n);
        
        // 从 localStorage 读取保存的语言设置
        const savedLocale = localStorage.getItem('locale') || 'en';
        await i18n.changeLanguage(savedLocale);
        setLocaleState(savedLocale);
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize i18n:', error);
      }
    };

    initialize();
  }, []);

  const setLocale = async (newLocale: string) => {
    if (!i18nInstance) return;
    
    try {
      await i18nInstance.changeLanguage(newLocale);
      setLocaleState(newLocale);
      localStorage.setItem('locale', newLocale);
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  // 使用 i18n 实例的 t 函数，而不是 useTranslation hook
  const t = (key: string, options?: any) => {
    if (!i18nInstance) return key;
    return i18nInstance.t(key, options);
  };

  const contextValue: I18nContextType = {
    t,
    i18n: i18nInstance,
    setLocale,
    locale,
  };

  if (!isInitialized || !i18nInstance) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}