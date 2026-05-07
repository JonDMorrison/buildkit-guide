import { test, expect } from "@playwright/test";

/**
 * Contractor signup → first project setup.
 *
 * Skeleton — selectors are TODO. ProjectPath's primary user is a contractor;
 * the signup flow needs to land them on a "create your first project" prompt.
 */

test.describe("Auth — contractor signup", () => {
  test.skip(true, "TODO: wire selectors against the live signup form.");

  test("a new contractor can sign up and reach the empty-projects state", async ({
    page,
  }) => {
    await page.goto("/signup");
    // TODO: fill business name, contractor email, password
    // TODO: submit and assert redirect to /projects (or onboarding)
    // TODO: assert empty-state CTA "Create your first project" is visible
    await expect(page).toHaveURL(/projects|onboarding/);
  });

  test("an existing contractor can log in", async ({ page }) => {
    await page.goto("/login");
    // TODO: fill credentials from .env.test (test contractor account)
    await expect(page).toHaveURL(/projects|dashboard/);
  });
});
