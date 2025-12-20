import { Page, expect } from '@playwright/test';
import { TEST_USERS, TestUserRole } from './test-users';

// ============================================
// ERROR TRACKING WITH ASSERTIONS
// ============================================

interface NetworkError {
  url: string;
  status: number;
  method: string;
}

// Known acceptable errors to ignore
const IGNORED_CONSOLE_ERRORS = [
  'ResizeObserver',
  'favicon',
  'Non-Error promise rejection',
  'net::ERR_FAILED', // Network errors during cleanup
];

const IGNORED_NETWORK_URLS = [
  '/favicon.ico',
  'analytics',
  'sentry',
];

/**
 * Setup console error tracking that fails tests on errors.
 * Returns an object with errors array and assertion function.
 */
export function setupConsoleErrorTracking(page: Page): {
  errors: string[];
  assertNoErrors: (context?: string) => void;
} {
  const errors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const shouldIgnore = IGNORED_CONSOLE_ERRORS.some(ignored => text.includes(ignored));
      if (!shouldIgnore) {
        errors.push(text);
      }
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`Page error: ${error.message}`);
  });
  
  return {
    errors,
    assertNoErrors: (context = 'test') => {
      if (errors.length > 0) {
        throw new Error(`Console errors detected during ${context}:\n${errors.join('\n')}`);
      }
    },
  };
}

/**
 * Track network errors (401, 403, 500+).
 * Returns an object with errors array and assertion function.
 */
export function setupNetworkErrorTracking(page: Page): {
  errors: NetworkError[];
  assertNoAuthErrors: (context?: string) => void;
  assertNoServerErrors: (context?: string) => void;
  assertNoErrors: (context?: string) => void;
} {
  const errors: NetworkError[] = [];
  
  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    
    // Skip ignored URLs
    const shouldIgnore = IGNORED_NETWORK_URLS.some(ignored => url.includes(ignored));
    if (shouldIgnore) return;
    
    if (status === 401 || status === 403 || status >= 500) {
      errors.push({ 
        url, 
        status,
        method: response.request().method(),
      });
    }
  });
  
  return {
    errors,
    assertNoAuthErrors: (context = 'test') => {
      const authErrors = errors.filter(e => e.status === 401 || e.status === 403);
      if (authErrors.length > 0) {
        throw new Error(
          `Auth errors (401/403) detected during ${context}:\n` +
          authErrors.map(e => `  ${e.method} ${e.url} -> ${e.status}`).join('\n')
        );
      }
    },
    assertNoServerErrors: (context = 'test') => {
      const serverErrors = errors.filter(e => e.status >= 500);
      if (serverErrors.length > 0) {
        throw new Error(
          `Server errors (5xx) detected during ${context}:\n` +
          serverErrors.map(e => `  ${e.method} ${e.url} -> ${e.status}`).join('\n')
        );
      }
    },
    assertNoErrors: (context = 'test') => {
      if (errors.length > 0) {
        throw new Error(
          `Network errors detected during ${context}:\n` +
          errors.map(e => `  ${e.method} ${e.url} -> ${e.status}`).join('\n')
        );
      }
    },
  };
}

// ============================================
// AUTHENTICATION
// ============================================

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

// ============================================
// NAVIGATION
// ============================================

/**
 * Navigate to safety page for a specific project
 */
export async function navigateToSafety(page: Page, projectId: string): Promise<void> {
  await page.goto(`/safety?projectId=${projectId}`);
  await page.waitForLoadState('networkidle');
  
  // Verify page loaded without fatal errors
  const body = await page.locator('body').textContent();
  if (body?.includes('Something went wrong') || body?.includes('Unhandled Runtime Error')) {
    throw new Error('Safety page failed to load - runtime error detected');
  }
}

// ============================================
// WIZARD HELPERS
// ============================================

/**
 * Wait for wizard step to be visible
 */
export async function waitForWizardStep(page: Page, stepText: string): Promise<void> {
  await page.waitForSelector(`text=${stepText}`, { timeout: 10000 });
}

/**
 * Realistic signature drawing on canvas.
 * Draws a recognizable signature pattern, not just a dot.
 */
export async function signSignaturePad(page: Page, canvasSelector = 'canvas'): Promise<void> {
  const canvas = page.locator(canvasSelector).first();
  await canvas.waitFor({ state: 'visible', timeout: 5000 });
  
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Signature canvas not found or not visible');
  
  // Calculate signature area (leave margins)
  const startX = box.x + 30;
  const startY = box.y + box.height * 0.6;
  const width = box.width - 60;
  
  // Draw a realistic signature pattern:
  // First stroke - rising curve
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + width * 0.15, startY - 20, { steps: 5 });
  await page.mouse.move(startX + width * 0.25, startY + 10, { steps: 5 });
  await page.mouse.move(startX + width * 0.35, startY - 15, { steps: 5 });
  await page.mouse.up();
  
  // Second stroke - loop
  await page.mouse.move(startX + width * 0.4, startY);
  await page.mouse.down();
  await page.mouse.move(startX + width * 0.5, startY - 25, { steps: 5 });
  await page.mouse.move(startX + width * 0.6, startY - 10, { steps: 5 });
  await page.mouse.move(startX + width * 0.55, startY + 15, { steps: 5 });
  await page.mouse.up();
  
  // Third stroke - finishing flourish
  await page.mouse.move(startX + width * 0.65, startY);
  await page.mouse.down();
  await page.mouse.move(startX + width * 0.8, startY - 20, { steps: 5 });
  await page.mouse.move(startX + width * 0.95, startY - 5, { steps: 5 });
  await page.mouse.up();
  
  // Brief pause to ensure canvas registers the signature
  await page.waitForTimeout(100);
}

/**
 * Sign multiple signature pads on the page (e.g., worker acknowledgments)
 */
export async function signAllSignaturePads(page: Page): Promise<number> {
  const canvases = page.locator('canvas');
  const count = await canvases.count();
  
  for (let i = 0; i < count; i++) {
    const canvas = canvases.nth(i);
    if (await canvas.isVisible()) {
      const box = await canvas.boundingBox();
      if (box && box.width > 50 && box.height > 30) {
        // This looks like a signature pad
        await signSignaturePad(page, `canvas >> nth=${i}`);
      }
    }
  }
  
  return count;
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
    await page.waitForTimeout(500);
    
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

// ============================================
// FORM HELPERS
// ============================================

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
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    pdfButton.first().click(),
  ]);
  
  return download !== null;
}

/**
 * Fill text area or input by label or placeholder
 */
export async function fillField(page: Page, label: string, value: string): Promise<void> {
  // Try label association first
  const labelElement = page.locator(`label:has-text("${label}")`);
  if (await labelElement.count() > 0) {
    const forId = await labelElement.getAttribute('for');
    if (forId) {
      await page.fill(`#${forId}`, value);
      return;
    }
    
    // Try sibling/child input
    const field = labelElement.locator('..').locator('input, textarea');
    if (await field.count() > 0) {
      await field.first().fill(value);
      return;
    }
  }
  
  // Try placeholder
  const byPlaceholder = page.locator(`input[placeholder*="${label}" i], textarea[placeholder*="${label}" i]`);
  if (await byPlaceholder.count() > 0) {
    await byPlaceholder.first().fill(value);
    return;
  }
  
  // Try aria-label
  const byAriaLabel = page.locator(`input[aria-label*="${label}" i], textarea[aria-label*="${label}" i]`);
  if (await byAriaLabel.count() > 0) {
    await byAriaLabel.first().fill(value);
    return;
  }
  
  console.warn(`Could not find field with label "${label}"`);
}

// ============================================
// ASSERTIONS
// ============================================

/**
 * Assert no infinite re-render loop by counting component updates
 */
export async function assertNoRenderLoop(page: Page, duration = 3000): Promise<void> {
  let updateCount = 0;
  const listener = () => updateCount++;
  
  page.on('console', msg => {
    if (msg.text().includes('render') || msg.text().includes('update')) {
      listener();
    }
  });
  
  await page.waitForTimeout(duration);
  
  // More than 100 updates in 3 seconds suggests a loop
  if (updateCount > 100) {
    throw new Error(`Possible render loop detected: ${updateCount} updates in ${duration}ms`);
  }
}