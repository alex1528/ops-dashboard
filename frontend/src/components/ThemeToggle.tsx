import { Button, Tooltip } from 'antd';
import { BulbOutlined, BulbFilled, DesktopOutlined } from '@ant-design/icons';
import { describeMode, useTheme } from '../theme';

/**
 * ThemeToggle：单按钮三态主题切换（auto → light → dark → auto）。
 *
 * - 显示当前生效的图标：auto 用「桌面/系统」图标，light 用空心灯泡，dark 用实心灯泡。
 * - tooltip 同时展示当前模式（含跟随系统的解析结果）与下一次点击会切到的模式。
 * - 主题状态由 <ThemeProvider>（src/theme.tsx）持久化到 localStorage。
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { mode, resolvedMode, cycleMode } = useTheme();

  const icon = mode === 'auto'
    ? <DesktopOutlined />
    : resolvedMode === 'dark'
      ? <BulbFilled />
      : <BulbOutlined />;

  const label = mode === 'auto'
    ? `跟随系统（当前：${resolvedMode === 'dark' ? '深色' : '浅色'}）`
    : describeMode(mode);

  const nextMode = mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto';

  return (
    <Tooltip title={`主题：${label}（点击切到「${describeMode(nextMode)}」）`}>
      <Button
        type="text"
        icon={icon}
        onClick={cycleMode}
        aria-label={`切换主题（当前 ${label}）`}
        className={className}
      />
    </Tooltip>
  );
}
