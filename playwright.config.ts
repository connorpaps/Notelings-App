import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      // Headless WebGL via SwiftShader (needed to render the three.js canvas)
      args: ['--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // Always own the server for E2E. Reusing a normal dev server would omit
    // the test-only auth and Realtime isolation environment variables.
    reuseExistingServer: false,
    timeout: 120_000,
    // The e2e baseline samples pixels from the WebGL canvas (corner-alpha +
    // readPixels), which needs preserveDrawingBuffer. Normal runs leave it
    // off for GPU memory; only the Playwright server turns it on.
    env: {
      // Pin the port: `baseURL` and `url` above are hard-coded to :3000, and an
      // ambient PORT (e.g. PORT=0 in some shells) would make `next dev` bind a
      // random port and hang the webServer health check.
      PORT: '3000',
      NEXT_PUBLIC_PRESERVE_DRAWING_BUFFER: '1',
      NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY: process.env.NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY ?? 'high',
      // E2E-only motor acceleration keeps physical route assertions fast under
      // SwiftShader; production and the normal dev server remain at real speed.
      NEXT_PUBLIC_NOTELINGS_E2E_FAST: '1',
      // Test-only auth bypass. The client and server both guard this with
      // NODE_ENV !== 'production'; it must never be set on a deployment.
      NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS: '1',
      // Keep workflow and visual tests hermetic; Realtime has its own
      // integration contract and must not turn unrelated tests red when the
      // external Supabase socket is unavailable.
      NEXT_PUBLIC_NOTELINGS_DISABLE_REALTIME: '1',
    },
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /(office-smoke|tag-explorer|librarian-chat|knowledge-graph|performance-renderer|unified-deployment)\.spec\.ts/,
      use: { browserName: 'chromium', launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader'] } },
    },
  ],
})
