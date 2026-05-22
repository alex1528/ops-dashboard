import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { App, Button, Tooltip } from 'antd';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { copyToClipboard } from '../utils/clipboard';

/**
 * CopyButton：通用的「复制 URL」按钮组件。
 *
 * - 阻止点击事件向 Resource_Card 容器冒泡，避免触发「打开链接 / 自动登录」。
 * - 复制成功时使用 Ant Design `messageApi`（来自 `App.useApp()`）反馈，
 *   并在 1500ms 内将图标切换为对勾、`aria-label` 临时切换为「已复制」。
 * - 当 `text` 为空字符串或纯空白字符时渲染禁用态，且不绑定任何点击/键盘处理。
 * - 显式实现 `onKeyDown`：当按下 Enter / Space 时阻止默认滚动并触发等价处理。
 */
export interface CopyButtonProps {
  /** 待复制的文本（一般是 resource.url） */
  text: string;
  /** 可选的 tooltip 文案，默认「复制链接」 */
  title?: string;
  /** 控件的 aria-label，默认「复制链接」 */
  ariaLabel?: string;
  /** 复制成功后向上层抛出，便于埋点（可选） */
  onCopied?: () => void;
}

const SUCCESS_FLASH_MS = 1500;
const DEFAULT_ARIA_LABEL = '复制链接';
const DEFAULT_TOOLTIP = '复制链接';
const COPIED_ARIA_LABEL = '已复制';
const SUCCESS_MESSAGE = '已复制链接到剪贴板';
const ERROR_MESSAGE = '复制失败，请手动选择 URL 复制';

function isBlank(text: string): boolean {
  return typeof text !== 'string' || text.trim() === '';
}

export default function CopyButton({ text, title, ariaLabel, onCopied }: CopyButtonProps) {
  const { message: messageApi } = App.useApp();
  const [copied, setCopied] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current !== null) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  // 卸载时清理 timeout，避免在已卸载组件上 setState
  useEffect(() => {
    return () => {
      clearSuccessTimer();
    };
  }, [clearSuccessTimer]);

  const disabled = isBlank(text);
  const tooltipTitle = title ?? DEFAULT_TOOLTIP;
  const baseAriaLabel = ariaLabel ?? DEFAULT_ARIA_LABEL;
  const currentAriaLabel = copied ? COPIED_ARIA_LABEL : baseAriaLabel;
  const icon = copied ? <CheckOutlined /> : <CopyOutlined />;

  const performCopy = useCallback(async () => {
    const result = await copyToClipboard(text);
    if (result.ok) {
      messageApi.success(SUCCESS_MESSAGE);
      clearSuccessTimer();
      setCopied(true);
      successTimerRef.current = setTimeout(() => {
        setCopied(false);
        successTimerRef.current = null;
      }, SUCCESS_FLASH_MS);
      onCopied?.();
    } else if (result.reason !== 'empty') {
      // 'empty' 已由禁用态规避；只在真正失败时反馈
      messageApi.error(ERROR_MESSAGE);
    }
  }, [text, messageApi, clearSuccessTimer, onCopied]);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      e.preventDefault();
      void performCopy();
    },
    [performCopy],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation();
        e.preventDefault();
        void performCopy();
      }
    },
    [performCopy],
  );

  if (disabled) {
    return (
      <Tooltip title={tooltipTitle}>
        <Button
          type="text"
          size="small"
          disabled
          icon={<CopyOutlined />}
          aria-label={baseAriaLabel}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipTitle}>
      <Button
        type="text"
        size="small"
        icon={icon}
        aria-label={currentAriaLabel}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      />
    </Tooltip>
  );
}
