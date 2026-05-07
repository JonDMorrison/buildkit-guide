import { test, expect } from "@playwright/test";

/**
 * Client invitation flow.
 *
 * Critical: the invite flow spans two edge functions. Read both before
 * touching either (per repo CLAUDE.md). This test asserts the *user-visible*
 * outcomes only — invitation sent, recipient can accept, post-accept access
 * is correctly scoped.
 */

test.describe("Client invitation — send, accept, scope", () => {
  test.skip(true, "TODO: configure test SMTP capture before enabling.");

  test("contractor can send a client invitation", async ({ page }) => {
    // TODO: log in as contractor (storage state)
    await page.goto("/projects/SEEDED_PROJECT_ID/clients");
    // TODO: click "Invite client"
    // TODO: fill client email, role
    // TODO: submit and assert success toast + pending invite row
  });

  test("invited client can accept and reach a scoped client dashboard", async ({
    page,
  }) => {
    // TODO: extract invite link from captured test SMTP message
    // TODO: visit invite link in an unauthenticated context
    // TODO: complete signup form on accept page
    // TODO: assert post-signup redirect lands on the project's client view only
    // TODO: assert client cannot see other projects (URL probe)
  });
});
