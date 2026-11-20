/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Short commit and build day, shown in Settings so each device can be checked. */
function appVersion(): string {
  let commit = process.env.GITHUB_SHA?.slice(0, 7);
  try {
    commit ??= execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    commit = 'local';
  }
  return `${new Date().toISOString().slice(0, 10)} (${commit})`;
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  // Relative base so the build works from any GitHub Pages sub-path.
  base: './',
  plugins: [
    react(),
    VitePWA({
      // A new version takes over as soon as it is installed (skipWaiting), so a
      // phone that never closes its tab still gets it. 'prompt' left phones
      // running the first version for days: it waited for a click the old
      // code could not show. The open page is not reloaded under the user;
      // useAppUpdates offers a Reload button instead.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'Tenk — 10,000 hours',
        short_name: 'Tenk',
        description: 'Track the hours you put into a skill on the way to 10,000.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#0f1628',
        theme_color: '#0f1628',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
