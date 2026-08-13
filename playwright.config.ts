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
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // The e2e baseline samples pixels from the WebGL canvas (corner-alpha +
    // readPixels), which needs preserveDrawingBuffer. Normal runs leave it
    // off for GPU memory; only the Playwright server turns it on.
    env: {
      NEXT_PUBLIC_PRESERVE_DRAWING_BUFFER: '1',
      NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY: process.env.NEXT_PUBLIC_NOTELINGS_RENDER_QUALITY ?? 'high',
      // Test-only auth bypass. The client and server both guard this with
      // NODE_ENV !== 'production'; it must never be set on a deployment.
      NEXT_PUBLIC_NOTELINGS_E2E_AUTH_BYPASS: '1',
    },
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /(office-smoke|tag-explorer|librarian-chat|knowledge-graph|performance-renderer)\.spec\.ts/,
      use: { browserName: 'chromium', launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader'] } },
    },
  ],
})
