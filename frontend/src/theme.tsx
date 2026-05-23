import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * 全站主题上下文：管理 light / dark / auto 三态，并持久化到 localStorage。
 *
 * - `mode` 是用户选择（auto = 跟随系统）；`resolvedMode` 是计算后的最终值（light | dark）。
 * - 切到 `auto` 时监听 `prefers-color-scheme` 变化，自动切换。
 * - 通过设置 `<html data-theme="light|dark">` 属性，让 index.css 中的非 Ant Design 元素
 *   （body、login 背景、status header 等）能用 CSS 变量切换主题。
 * - AntD 的主题切换由 main.tsx 中的 <ConfigProvider theme={{ algorithm }}> 处理，
 *   它读取此处暴露的 `resolvedMode`。
 */

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  /** 用户选择的模式，可为 'auto' */
  mode: ThemeMode;
  /** 解析后的实际模式，永远只会是 'light' 或 'dark'（auto 已被解析为系统偏好） */
  resolvedMode: ResolvedThemeMode;
  /** 设置主题模式并持久化 */
  setMode: (mode: ThemeMode) => void;
  /** 在 auto → light → dark → auto 之间循环切换，便于一个按钮即可控制 */
  cycleMode: () => void;
}

const STORAGE_KEY = 'ops-dashboard-theme';
const ALL_MODES: ThemeMode[] = ['auto', 'light', 'dark'];

const ThemeContext = createContext<ThemeContextValue>(null!);

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch {
    // 隐私模式 / 禁用 storage 时回退默认
  }
  return 'auto';
}

function readSystemPreference(): ResolvedThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(() => readSystemPreference());

  // 监听系统主题变化（仅在 auto 模式下生效）
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemMode(e.matches ? 'dark' : 'light');
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    // Safari < 14 兼容
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  const resolvedMode: ResolvedThemeMode = mode === 'auto' ? systemMode : mode;

  // 把解析后的主题写入 <html data-theme="...">，让 CSS 中的非 AntD 元素也能跟着切
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', resolvedMode);
    // 同步 color-scheme，提示浏览器/原生控件（如滚动条、表单元素）使用对应配色
    document.documentElement.style.colorScheme = resolvedMode;
  }, [resolvedMode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 忽略写入失败
    }
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((prev) => {
      const idx = ALL_MODES.indexOf(prev);
      const next = ALL_MODES[(idx + 1) % ALL_MODES.length];
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // 忽略写入失败
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, resolvedMode, setMode, cycleMode }),
    [mode, resolvedMode, setMode, cycleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** 简易的人类可读标签，便于 UI 显示当前主题状态 */
export function describeMode(mode: ThemeMode): string {
  switch (mode) {
    case 'light':
      return '浅色';
    case 'dark':
      return '深色';
    case 'auto':
    default:
      return '跟随系统';
  }
}
