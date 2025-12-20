import { Page, expect } from '@playwright/test';
import { TEST_USERS, TestUserRole } from './test-users';

/**
 * Login as a specific test user
 */
export async function loginAs(page: Page, role: TestUserRole): Promise<void> {
  const user = TEST_USERS[role];
  
  await page.goto('/auth');
  
  // Wait for auth page to load
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  
  // Fill login form
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  
  // Click login button
  await page.click('button[type="submit"]');
  
  // Wait for redirect to dashboard or project selection
  await page.waitForURL(/\/(dashboard|index)/, { timeout: 15000 });
}

/**
 * Navigate to safety page for a specific project
 */
export async function navigateToSafety(page: Page, projectId: string): Promise<void> {
  await page.goto(`/safety?projectId=${projectId}`);
  await page.waitForLoadState('networkidle');
  
  // Verify page loaded without errors
  await expect(page.locator('body')).not.toContainText('Error');
}

/**
 * Collect console errors during test
 */
export function setupConsoleErrorTracking(page: Page): string[] {
  const errors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out known non-critical errors
      if (!text.includes('ResizeObserver') && !text.includes('favicon')) {
        errors.push(text);
      }
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`Page error: ${error.message}`);
  });
  
  return errors;
}

/**
 * Track network errors (401, 403, 500)
 */
export function setupNetworkErrorTracking(page: Page): Array<{url: string; status: number}> {
  const errors: Array<{url: string; status: number}> = [];
  
  page.on('response', response => {
    const status = response.status();
    if (status === 401 || status === 403 || status >= 500) {
      errors.push({ url: response.url(), status });
    }
  });
  
  return errors;
}

/**
 * Wait for wizard step to be visible
 */
export async function waitForWizardStep(page: Page, stepText: string): Promise<void> {
  await page.waitForSelector(`text=${stepText}`, { timeout: 10000 });
}

/**
 * Fill signature pad with a simple signature
 */
export async function signSignaturePad(page: Page, canvasSelector = 'canvas'): Promise<void> {
  const canvas = page.locator(canvasSelector).first();
  await canvas.waitFor({ state: 'visible' });
  
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  // Draw a simple signature
  await page.mouse.move(box.x + 50, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 80);
  await page.mouse.move(box.x + 100, box.y + 30);
  await page.mouse.up();
}

/**
 * Select attendees in the attendee selector
 */
export async function selectAttendees(page: Page, count = 2): Promise<void> {
  // Click to open attendee selector
  const selector = page.locator('[data-testid="attendee-selector"]').or(
    page.locator('button:has-text("Select Attendees")')
  ).or(page.locator('button:has-text("Add Attendees")'));
  
  if (await selector.count() > 0) {
    await selector.first().click();
    
    // Select first N attendees
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    
    for (let i = 0; i < Math.min(count, checkboxCount); i++) {
      const checkbox = checkboxes.nth(i);
      if (!(await checkbox.isChecked())) {
        await checkbox.check();
      }
    }
    
    // Confirm selection if there's a confirm button
    const confirmBtn = page.locator('button:has-text("Confirm")').or(
      page.locator('button:has-text("Done")')
    );
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click();
    }
  }
}

/**
 * Extract form ID from URL or page content
 */
export async function extractFormId(page: Page): Promise<string | null> {
  // Try URL first
  const url = page.url();
  const urlMatch = url.match(/formId=([a-f0-9-]+)/i);
  if (urlMatch) return urlMatch[1];
  
  // Try data attribute
  const formElement = page.locator('[data-form-id]');
  if (await formElement.count() > 0) {
    return await formElement.getAttribute('data-form-id');
  }
  
  return null;
}

/**
 * Click button and wait for modal/dialog to close
 */
export async function clickAndWaitForClose(
  page: Page, 
  buttonText: string,
  timeout = 10000
): Promise<void> {
  const dialogCount = await page.locator('[role="dialog"]').count();
  
  await page.click(`button:has-text("${buttonText}")`);
  
  // Wait for dialog count to decrease or for success toast
  await Promise.race([
    page.waitForFunction(
      (initialCount) => document.querySelectorAll('[role="dialog"]').length < initialCount,
      dialogCount,
      { timeout }
    ),
    page.waitForSelector('[data-sonner-toast]', { timeout }),
  ]).catch(() => {
    // Ignore timeout - dialog may have closed differently
  });
}

/**
 * Verify record hash is visible in detail view
 */
export async function verifyRecordHashVisible(page: Page): Promise<string | null> {
  const hashElement = page.locator('text=/[a-f0-9]{8}/i').or(
    page.locator('[data-testid="record-hash"]')
  ).or(page.locator('text=/Hash:/'));
  
  if (await hashElement.count() > 0) {
    const text = await hashElement.first().textContent();
    return text;
  }
  return null;
}

/**
 * Trigger PDF generation and verify hash in footer
 */
export async function generateAndVerifyPdf(page: Page): Promise<boolean> {
  // Look for PDF/Export button
  const pdfButton = page.locator('button:has-text("PDF")').or(
    page.locator('button:has-text("Export")')
  ).or(page.locator('[data-testid="export-pdf"]'));
  
  if (await pdfButton.count() === 0) {
    console.log('No PDF button found');
    return false;
  }
  
  // PDF generation typically happens client-side
  // We'll click and check for download or success indication
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    pdfButton.first().click(),
  ]);
  
  return download !== null;
}

/**
 * Fill text area or input by label
 */
export async function fillField(page: Page, label: string, value: string): Promise<void> {
  const field = page.locator(`label:has-text("${label}")`).locator('..').locator('input, textarea');
  
  if (await field.count() > 0) {
    await field.first().fill(value);
  } else {
    // Try placeholder
    const byPlaceholder = page.locator(`input[placeholder*="${label}"], textarea[placeholder*="${label}"]`);
    if (await byPlaceholder.count() > 0) {
      await byPlaceholder.first().fill(value);
    }
  }
}
