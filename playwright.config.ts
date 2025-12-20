import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for BuildSense E2E tests
 * 
 * REQUIREMENTS:
 * - E2E_ENV=test must be set
 * - SUPABASE_SERVICE_ROLE_KEY must be set
 * - VITE_SUPABASE_URL must point to an allowed test project
 * 
 * Run with: E2E_ENV=test pnpm test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  
  // Sequential execution - safety tests have state dependencies
  fullyParallel: false,
  workers: 1,
  
  // CI configuration
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  
  // Reporters - HTML for debugging, list for CI output
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  use: {
    // Base URL with fallback for local dev
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    
    // Tracing and artifacts for debugging failures
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    // Consistent viewport
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local dev server before starting tests (skip in CI)
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },

  // Output directory for screenshots/videos on failure
  outputDir: 'test-results/',

  // Global timeout for each test (generous for complex wizard flows)
  timeout: 90000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },
  
  // Global setup could be added here if needed
  // globalSetup: './e2e/global-setup.ts',
  // globalTeardown: './e2e/global-teardown.ts',
});
