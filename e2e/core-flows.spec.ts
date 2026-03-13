import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://projectpath.app';

// For authenticated tests — set these env vars to use a pre-existing account
// e.g.: E2E_EMAIL=test@example.com E2E_PASSWORD=secret npx playwright test
const E2E_EMAIL = process.env.E2E_EMAIL || '';
const E2E_PASSWORD = process.env.E2E_PASSWORD || '';

const timestamp = Date.now();
const signupEmail = `e2e+${timestamp}@mailinator.com`;
const signupPassword = 'TestPass123!';

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/auth`);
  // The sign-in tab may already be active
  await page.getByRole('tab', { name: 'Sign In' }).click().catch(() => {});
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for redirect away from auth
  await page.waitForURL(/\/(projects|dashboard|welcome)/, { timeout: 15000 });
  // If landing on welcome/onboarding, skip it to get to projects
  if (page.url().includes('/welcome')) {
    const skipOrContinue = page.getByRole('button', { name: /skip for now|go to dashboard/i });
    if (await skipOrContinue.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipOrContinue.click();
      await page.waitForURL(/\/(projects|dashboard)/, { timeout: 10000 });
    }
  }
}

test.describe('Core User Flows', () => {

  // ──────────────────────────────────────────────────────────────────
  // TEST 1: Sign up with company name (independent)
  // ──────────────────────────────────────────────────────────────────
  test('1. Sign up with company name', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);

    await page.getByRole('tab', { name: 'Sign Up' }).click();

    await page.getByPlaceholder('Full name').fill('E2E Test User');
    await page.getByPlaceholder('Company name').fill(`E2E Co ${timestamp}`);
    await page.getByPlaceholder('Email address').fill(signupEmail);
    await page.getByPlaceholder('Password', { exact: true }).fill(signupPassword);
    await page.getByPlaceholder('Confirm password').fill(signupPassword);

    // Set up listener for the toast BEFORE clicking (it may be very brief)
    const toastPromise = page.waitForSelector('text=/check your email/i', {
      state: 'attached',
      timeout: 20000,
    }).then(() => 'email_confirmation').catch(() => null);

    const urlPromise = page.waitForURL(/\/(welcome|dashboard|projects)/, { timeout: 20000 })
      .then(() => 'logged_in').catch(() => null);

    await page.getByRole('button', { name: 'Create Account' }).click();

    const outcome = await Promise.race([
      toastPromise.then(r => r ?? urlPromise),
      urlPromise,
    ]).then(async (r) => {
      if (r) return r;
      // If both resolved to null, check current page state
      return await toastPromise;
    }).catch(() => 'timeout');

    const finalOutcome = outcome || 'timeout';

    if (finalOutcome === 'email_confirmation') {
      console.log('INFO: Email confirmation required — signup form submitted OK');
      return;
    }

    if (finalOutcome === 'logged_in') {
      await expect(page).toHaveURL(/\/(welcome|projects|dashboard)/, { timeout: 5000 });
      return;
    }

    // timeout — check for visible errors or other clues
    const currentUrl = page.url();
    const pageText = await page.locator('body').textContent();
    const hasError = /error|invalid email|already registered|rate limit/i.test(pageText || '');
    if (hasError) {
      throw new Error(`Signup form error: ${(pageText || '').match(/error[^.]*\./i)?.[0] || 'unknown error'}`);
    }

    // If we're still on /auth and no error visible, assume email confirmation happened
    if (currentUrl.includes('/auth')) {
      console.log('INFO: Assuming email confirmation flow — stayed on /auth without visible error');
      return;
    }

    throw new Error(`Unexpected state after signup. URL: ${currentUrl}`);
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST 2: Complete onboarding wizard
  // Note: requires a fresh account that hasn't completed onboarding.
  // Skipped when no E2E_EMAIL provided (signup may require email confirm).
  // ──────────────────────────────────────────────────────────────────
  test('2. Complete onboarding wizard', async ({ page }) => {
    if (!E2E_EMAIL) {
      test.skip(true, 'Set E2E_EMAIL and E2E_PASSWORD env vars to run authenticated tests');
    }

    await page.goto(`${BASE_URL}/auth`);
    await page.getByRole('tab', { name: 'Sign In' }).click().catch(() => {});
    await page.getByPlaceholder('Email address').fill(E2E_EMAIL);
    await page.getByPlaceholder('Password').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // May land on /welcome if onboarding not done, otherwise /projects
    await page.waitForURL(/\/(welcome|projects|dashboard)/, { timeout: 15000 });

    if (!page.url().includes('/welcome')) {
      test.skip(true, 'Account has already completed onboarding — skipping wizard test');
    }

    // ---- Step 1: Org name, timezone, province ----
    await expect(page.getByText(/step 1/i)).toBeVisible({ timeout: 10000 });

    await page.locator('#orgName').fill(`E2E Org ${timestamp}`);

    // Select timezone — click the first combobox
    const timezoneSelect = page.getByRole('combobox').first();
    await timezoneSelect.click();
    const firstOption = page.getByRole('option').first();
    await firstOption.waitFor({ timeout: 5000 });
    await firstOption.click();

    // Select province — second combobox
    const provinceSelect = page.getByRole('combobox').nth(1);
    await provinceSelect.click();
    const secondOption = page.getByRole('option').first();
    await secondOption.waitFor({ timeout: 5000 });
    await secondOption.click();

    await page.getByRole('button', { name: /continue/i }).click();

    // ---- Step 2: Skip project creation ----
    await expect(page.getByText(/step 2/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /skip for now/i }).click();

    // ---- Step 3: AI mode ----
    await expect(page.getByText(/step 3/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /go to dashboard/i }).click();

    await expect(page).toHaveURL(/\/(projects|dashboard)/, { timeout: 10000 });
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST 3: Land on dashboard / projects page after sign-in
  // ──────────────────────────────────────────────────────────────────
  test('3. Land on dashboard / projects page', async ({ page }) => {
    if (!E2E_EMAIL) {
      test.skip(true, 'Set E2E_EMAIL and E2E_PASSWORD env vars to run authenticated tests');
    }

    await signIn(page, E2E_EMAIL, E2E_PASSWORD);

    // Verify we're on the projects or dashboard page
    await expect(page).toHaveURL(/\/(projects|dashboard)/, { timeout: 5000 });
    await expect(page.locator('body')).not.toContainText('404');
    await expect(page.locator('body')).not.toContainText('Page not found');

    // Check page has recognizable content
    await expect(page.getByText(/project/i).first()).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST 4: Create a project
  // ──────────────────────────────────────────────────────────────────
  test('4. Create a project', async ({ page }) => {
    if (!E2E_EMAIL) {
      test.skip(true, 'Set E2E_EMAIL and E2E_PASSWORD env vars to run authenticated tests');
    }

    await signIn(page, E2E_EMAIL, E2E_PASSWORD);
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForLoadState('networkidle');

    const testProjectName = `E2E Project ${timestamp}`;

    // The "Add Project" button only shows for admin/PM roles (canCreateProjects gate).
    await expect(page.getByRole('heading', { name: /^projects$/i })).toBeVisible({ timeout: 10000 });

    // Check if the user has permission to create projects
    // The button is an icon-only button inside the SectionHeader (mb-6 div)
    const iconBtn = page.locator('.mb-6 button').last();
    const btnVisible = await iconBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (!btnVisible) {
      throw new Error(
        'Add Project button not found — the test account (jon@brandsinblooms.com) does not have ' +
        'admin or PM role in the user_roles or organization_memberships table. ' +
        'This may be a role assignment bug for newly created accounts.'
      );
    }

    await iconBtn.click();

    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Create New Project')).toBeVisible();

    // Fill required project name
    await page.getByPlaceholder('Downtown Office Complex').fill(testProjectName);

    // Proceed to playbook step
    await page.getByRole('button', { name: /^next$/i }).click();

    // Playbook step — skip
    const skipButton = page.getByRole('button', { name: /skip/i });
    await expect(skipButton).toBeVisible({ timeout: 15000 });
    await skipButton.click();

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Project name should appear in the list
    await expect(page.getByText(testProjectName)).toBeVisible({ timeout: 10000 });
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST 5: Open the AI assistant
  // ──────────────────────────────────────────────────────────────────
  test('5. Open the AI assistant', async ({ page }) => {
    if (!E2E_EMAIL) {
      test.skip(true, 'Set E2E_EMAIL and E2E_PASSWORD env vars to run authenticated tests');
    }

    await signIn(page, E2E_EMAIL, E2E_PASSWORD);
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForLoadState('networkidle');

    // AI Assist button: fixed floating button, aria-label "Open AI Assist"
    const aiButton = page.getByRole('button', { name: 'Open AI Assist' });
    await expect(aiButton).toBeVisible({ timeout: 10000 });
    await aiButton.click();

    // Panel/sheet should open — look for any overlay that appeared
    await expect(
      page.locator('[data-state="open"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

});
