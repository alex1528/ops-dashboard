/**
 * Clipboard_Service：统一的剪贴板写入入口。
 *
 * 实现要点：
 * - 入参为空字符串或纯空白字符 → 直接返回 `{ ok:false, reason:'empty' }`，
 *   不调用任何剪贴板 API、不打印 `console.error`。
 * - 优先调用 `navigator.clipboard.writeText`，前提是 API 存在且当前文档处于安全上下文
 *   （`window.isSecureContext === true`）。
 * - 主路径任何失败/不可用时降级到 `<textarea>` + `document.execCommand('copy')`：
 *   将 `<textarea>` 临时挂载到 `document.body`、`select()`、执行命令，最后 `removeChild`
 *   并将焦点还原到调用前的 `document.activeElement`。
 * - 任何捕获到的异常通过 `console.error('[clipboard]', cause)` 输出可定位日志，
 *   并返回 `{ ok:false, reason, cause }`。失败原因 `reason` 的映射：
 *     - `denied`：来自 `NotAllowedError` 类型的 DOMException
 *     - `unsupported`：主、降级两条路径都不可用
 *     - `unknown`：其他失败
 */

export type CopyResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'unsupported' | 'denied' | 'unknown'; cause?: unknown };

export async function copyToClipboard(text: string): Promise<CopyResult> {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, reason: 'empty' };
  }

  const hasClipboardApi =
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function' &&
    typeof window !== 'undefined' &&
    window.isSecureContext === true;

  const hasFallback =
    typeof document !== 'undefined' &&
    !!document.body &&
    typeof document.execCommand === 'function';

  if (!hasClipboardApi && !hasFallback) {
    return { ok: false, reason: 'unsupported' };
  }

  let primaryError: unknown | undefined;

  if (hasClipboardApi) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch (cause) {
      primaryError = cause;
      console.error('[clipboard]', cause);
      // 失败时继续走降级路径
    }
  }

  if (!hasFallback) {
    return {
      ok: false,
      reason: classifyReason(primaryError),
      cause: primaryError,
    };
  }

  try {
    const ok = execCommandFallback(text);
    if (ok) {
      return { ok: true };
    }
    if (primaryError !== undefined) {
      return {
        ok: false,
        reason: classifyReason(primaryError),
        cause: primaryError,
      };
    }
    const cause = new Error('document.execCommand("copy") returned false');
    console.error('[clipboard]', cause);
    return { ok: false, reason: 'unknown', cause };
  } catch (cause) {
    if (primaryError !== undefined) {
      return {
        ok: false,
        reason: classifyReason(primaryError),
        cause: primaryError,
      };
    }
    console.error('[clipboard]', cause);
    return { ok: false, reason: classifyReason(cause), cause };
  }
}

function execCommandFallback(text: string): boolean {
  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.padding = '0';
  textarea.style.border = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    try {
      textarea.setSelectionRange(0, text.length);
    } catch {
      // 某些浏览器的特定输入控件不支持 setSelectionRange，忽略即可
    }
    return document.execCommand('copy');
  } finally {
    if (textarea.parentNode === document.body) {
      document.body.removeChild(textarea);
    }
    previouslyFocused?.focus?.();
  }
}

function classifyReason(err: unknown): 'denied' | 'unknown' {
  if (isNotAllowedError(err)) {
    return 'denied';
  }
  return 'unknown';
}

function isNotAllowedError(err: unknown): boolean {
  if (err == null) return false;
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'NotAllowedError';
  }
  if (typeof err === 'object' && err !== null) {
    const name = (err as { name?: unknown }).name;
    if (name === 'NotAllowedError') return true;
  }
  return false;
}
