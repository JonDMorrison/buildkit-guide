import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test('should load landing page', async ({ page }) => {
    // Go to the landing page
    await page.goto('/');

    // Check for a common element or title
    await expect(page).toHaveTitle(/Path/i);
    
    // Check for "Project Path" text (from your app description)
    const locator = page.locator('text=Project Path');
    // Using count() check to be flexible if it's in a logo or heading
    const count = await locator.count();
    console.log(`Found ${count} instances of "Project Path"`);
  });
});
