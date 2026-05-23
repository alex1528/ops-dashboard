import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { AuthProvider } from './auth';
import { ThemeProvider, useTheme } from './theme';
import './index.css';

/**
 * AntD 主题桥接：从 ThemeProvider 读取 resolvedMode，
 * 选择 defaultAlgorithm（浅色）或 darkAlgorithm（深色）。
 */
function ThemedAntdProvider({ children }: { children: React.ReactNode }) {
  const { resolvedMode } = useTheme();
  const algorithm = resolvedMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm,
        token: {
          // 主色保持品牌一致，借助 AntD 的设计 token 让两套主题自动派生
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ThemedAntdProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemedAntdProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
