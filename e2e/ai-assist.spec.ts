import { test, expect } from "@playwright/test";

/**
 * AI Assist conversational flow.
 *
 * AI Assist uses OpenAI function calling — do not switch to simple completion.
 * For tests, prefer stubbing the OpenAI call at the edge function level rather
 * than burning real tokens on every CI run.
 *
 * TODO before enabling:
 *  - Add a TEST_AI_ASSIST_STUB env var path that intercepts the edge function
 *    and returns a deterministic canned response.
 *  - Or use Playwright's page.route to mock the supabase function call.
 */

test.describe("AI Assist — open, prompt, response renders", () => {
  test.skip(true, "TODO: stub OpenAI before enabling — do not run live.");

  test("user can open AI Assist drawer", async ({ page }) => {
    await page.goto("/projects");
    // TODO: click the AI Assist button
    // TODO: assert the drawer/modal is visible
    // TODO: assert input field is focusable
  });

  test("sending a prompt renders an assistant response", async ({ page }) => {
    // TODO: page.route the supabase function endpoint to return a canned reply
    await page.goto("/projects");
    // TODO: open AI Assist
    // TODO: type a prompt, submit
    // TODO: assert the canned reply text appears in the conversation
    // TODO: assert no console errors fired
  });

  test("function-call tool invocations render as structured cards", async ({
    page,
  }) => {
    // TODO: stub a function-call response (e.g. create_task with args)
    // TODO: assert the structured card UI renders, not just raw JSON
  });
});
