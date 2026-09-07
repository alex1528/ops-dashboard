// ─────────────────────────────────────────────────────────────────────────────
// SSH terminal byte-level debugger.
//
// Purpose: definitively diagnose why vim is unusable in the xterm.js terminal
// while nano works. Instead of theorizing about xterm internals, this logs the
// EXACT bytes crossing the I/O boundary:
//   • OUT  → what xterm.onData emits when you press a key (e.g. `i`, `Esc`)
//   • IN   → what the backend sends us to render (vim's startup / repaint output)
//
// Zero runtime impact by default: logging is OFF unless explicitly enabled via
//   localStorage.setItem('sshDebug', '1')   (then reload)
// Disable with:
//   localStorage.removeItem('sshDebug')
//
// This is a diagnostic aid; it never alters the byte stream.
// ─────────────────────────────────────────────────────────────────────────────

let cachedEnabled: boolean | null = null;

/** True when the operator has opted in via localStorage.sshDebug === '1'. */
export function isSshDebugEnabled(): boolean {
  if (cachedEnabled !== null) return cachedEnabled;
  try {
    cachedEnabled = localStorage.getItem('sshDebug') === '1';
  } catch {
    cachedEnabled = false;
  }
  return cachedEnabled;
}

/** Render a byte value as a human-readable token (control chars named). */
function byteToken(b: number): string {
  switch (b) {
    case 0x1b:
      return 'ESC';
    case 0x0d:
      return 'CR';
    case 0x0a:
      return 'LF';
    case 0x09:
      return 'TAB';
    case 0x08:
      return 'BS';
    case 0x7f:
      return 'DEL';
    case 0x20:
      return 'SP';
    default:
      break;
  }
  if (b < 0x20) return `^${String.fromCharCode(b + 0x40)}`; // e.g. ^C, ^O, ^X
  if (b >= 0x20 && b < 0x7f) return JSON.stringify(String.fromCharCode(b)); // printable
  return `0x${b.toString(16).padStart(2, '0')}`; // high byte
}

/** Convert an arbitrary payload to an array of byte values. */
function toBytes(data: string | ArrayBuffer | Uint8Array): number[] {
  if (typeof data === 'string') {
    // Encode as UTF-8 so control chars and multi-byte glyphs are visible as bytes.
    return Array.from(new TextEncoder().encode(data));
  }
  if (data instanceof ArrayBuffer) return Array.from(new Uint8Array(data));
  if (data instanceof Uint8Array) return Array.from(data);
  return [];
}

/**
 * Log a chunk of terminal I/O in hex + named-token form.
 * @param dir      'OUT' = key the user pressed (xterm → SSH); 'IN' = SSH → xterm
 * @param data     the raw payload (string for OUT, ArrayBuffer/Uint8Array for IN)
 */
export function logSshBytes(dir: 'OUT' | 'IN', data: string | ArrayBuffer | Uint8Array): void {
  if (!isSshDebugEnabled()) return;
  const bytes = toBytes(data);
  if (bytes.length === 0) return;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
  const tokens = bytes.map(byteToken).join(' ');
  const arrow = dir === 'OUT' ? '⌨️  OUT (key→ssh)' : '📥 IN  (ssh→term)';
  // Bright, greppable prefix so the operator can filter the console easily.
  // eslint-disable-next-line no-console
  console.log(
    `%c[sshDebug] ${arrow} len=${bytes.length}\n  hex   : ${hex}\n  tokens: ${tokens}`,
    dir === 'OUT' ? 'color:#00d0ff' : 'color:#00ff88',
  );
}

/** Minimal shape of the xterm.js Terminal methods we rely on here. */
interface XtermWritable {
  write(data: string | Uint8Array): void;
}

/**
 * Robustly write a backend `ssh:data` payload into an xterm terminal.
 *
 * WHY THIS EXISTS — the vim-freeze root cause:
 * The backend emits raw bytes via `client.emit('ssh:data', buffer)` (a Node
 * Buffer). socket.io transports that as a binary frame, but the browser client
 * may hand it to us as ANY of these, depending on version / engine.io
 * `binaryType`:
 *   • ArrayBuffer
 *   • a TypedArray / DataView (e.g. Uint8Array) whose .buffer is an ArrayBuffer
 *   • a Blob (when binaryType === 'blob')
 * The previous handler only matched `ArrayBuffer` and `{ data: string }`. When
 * the runtime delivered a Uint8Array or Blob instead, BOTH branches missed and
 * the chunk was silently dropped. Short command output happened to slip
 * through, but vim's dense full-screen repaint (alt-screen switch + redraw)
 * arrives as large binary frames — those got dropped, so the screen froze while
 * keystrokes still reached the PTY. nano's tiny output masked the bug. This
 * helper normalizes every possible shape so nothing is ever dropped.
 *
 * @returns true if the payload was handled (or scheduled, for Blob), else false
 */
export function writeSshData(
  term: XtermWritable,
  data: unknown,
): boolean {
  // 1) ArrayBuffer → view as bytes
  if (data instanceof ArrayBuffer) {
    const bytes = new Uint8Array(data);
    logSshBytes('IN', bytes);
    term.write(bytes);
    return true;
  }

  // 2) TypedArray / DataView (Uint8Array is the common socket.io delivery)
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    logSshBytes('IN', bytes);
    term.write(bytes);
    return true;
  }

  // 3) Blob (binaryType === 'blob') → async read, then write
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    void data.arrayBuffer().then((buf) => {
      const bytes = new Uint8Array(buf);
      logSshBytes('IN', bytes);
      term.write(bytes);
    });
    return true;
  }

  // 4) Legacy string, either bare or wrapped as { data: string }
  if (typeof data === 'string') {
    logSshBytes('IN', data);
    term.write(data);
    return true;
  }
  if (
    data &&
    typeof data === 'object' &&
    typeof (data as { data?: unknown }).data === 'string'
  ) {
    const s = (data as { data: string }).data;
    logSshBytes('IN', s);
    term.write(s);
    return true;
  }

  return false;
}
