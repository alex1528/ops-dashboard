/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Build-time default for the SSH terminal byte logger ('1' enables it).
   * Set VITE_SSH_DEBUG in the repo-root .env; Compose forwards it as a Docker
   * build arg into the frontend build stage. A `sshDebug` localStorage entry
   * overrides this at runtime. See src/utils/sshDebug.ts.
   */
  readonly VITE_SSH_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
