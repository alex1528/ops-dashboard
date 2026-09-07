import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // xterm.js 6.0.0 ships pre-minified ESM. When esbuild re-minifies it with a
  // target of es2020 or lower, the `||=` inside InputHandler.requestMode (the
  // DECRQM terminal-mode handler) is lowered to `r || (r = {})`, then DCE drops
  // the `let r` declaration but keeps the assignment → a ReferenceError is
  // thrown synchronously inside WriteBuffer._innerWrite the first time a TUI app
  // (vim/htop) sends a DECRQM query at startup. That permanently kills the write
  // buffer: the screen freezes while keystrokes still reach the PTY, so vim can
  // neither be edited nor exited. nano never sends DECRQM, which is why it works.
  // Targeting es2021+ prevents the `||=` lowering and fixes the crash.
  // See https://github.com/xtermjs/xterm.js/issues/5800
  build: {
    target: 'es2021',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
