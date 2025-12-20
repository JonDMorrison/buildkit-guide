# E2E Testing Guide

## Overview

This project uses Playwright for end-to-end testing of the `/safety` module. The tests verify critical flows including form creation, amendments, hash generation, and permission enforcement.

## Prerequisites

1. **Service Role Key**: Required for test data seeding
   ```bash
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

2. **Test Environment URL** (optional):
   ```bash
   export PLAYWRIGHT_BASE_URL="http://localhost:5173"
   ```

## Running Tests

### Install Playwright browsers (first time only)
```bash
npx playwright install chromium
```

### Run all E2E tests
```bash
npm run test:e2e
```

### Run with UI mode (for debugging)
```bash
npm run test:e2e:ui
```

### Run specific test file
```bash
npx playwright test e2e/safety.spec.ts
```

### Run in headed mode (see browser)
```bash
npx playwright test --headed
```

## Test Coverage

The safety E2E suite covers:

| # | Test Area | Description |
|---|-----------|-------------|
| 1 | Page Load | Verifies /safety loads without errors, renders list/empty state |
| 2 | Daily Safety Log | Full wizard flow, attendees, signatures, record_hash verification |
| 3 | Toolbox Meeting | Create meeting with topics, verify hash and PDF |
| 4 | Near Miss | Minimal field form, hash verification |
| 5 | Incident Report | Legacy SafetyFormModal path, hash fix verification |
| 6 | Right to Refuse | Worker role permissions, RLS verification |
| 7 | Amendment Flow | Request → Approve flow, hash chain verification |
| 8 | Immutability | Direct update rejection, amendment-only modification |

## Test Users

Tests use seeded test users with specific roles:

| Role | Email | Purpose |
|------|-------|---------|
| Admin | e2e-admin@buildsense.test | Admin operations |
| PM | e2e-pm@buildsense.test | Project manager flows |
| Foreman | e2e-foreman@buildsense.test | Form creation, signing |
| Worker | e2e-worker@buildsense.test | Worker-only forms (RTR) |

## CI Integration

Tests run automatically on PRs affecting:
- `src/pages/Safety.tsx`
- `src/components/safety/**`
- `src/lib/recordHash.ts`
- `supabase/migrations/**`
- `supabase/functions/**`
- `e2e/**`

### Required CI Secrets

Configure in GitHub repository settings:
- `PLAYWRIGHT_BASE_URL` - Deployed app URL for testing
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for seeding

## Debugging Failed Tests

1. **View HTML report**:
   ```bash
   npx playwright show-report
   ```

2. **Check screenshots**: Located in `test-results/` on failure

3. **Run with trace**:
   ```bash
   npx playwright test --trace on
   ```

4. **View trace**:
   ```bash
   npx playwright show-trace test-results/<test-name>/trace.zip
   ```

## Adding New Tests

1. Create test file in `e2e/` directory
2. Use helpers from `e2e/utils/`:
   - `test-users.ts` - User seeding, DB operations
   - `page-helpers.ts` - Login, navigation, form filling

Example:
```typescript
import { test, expect } from '@playwright/test';
import { loginAs, navigateToSafety } from './utils/page-helpers';
import { seedTestData, TestContext } from './utils/test-users';

let ctx: TestContext;

test.beforeAll(async () => {
  ctx = await seedTestData();
});

test('my new test', async ({ page }) => {
  await loginAs(page, 'pm');
  await navigateToSafety(page, ctx.projectId);
  // ... assertions
});
```

## Troubleshooting

### Tests fail with "SUPABASE_SERVICE_ROLE_KEY is required"
Set the environment variable before running tests.

### Tests timeout on CI
- Check if Supabase is accessible from CI runner
- Increase timeout in `playwright.config.ts`

### Flaky tests
- Add `await page.waitForLoadState('networkidle')` after navigation
- Use specific selectors instead of text matching
- Increase `actionTimeout` for slow operations
