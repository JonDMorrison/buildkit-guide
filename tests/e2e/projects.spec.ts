import { test, expect } from "@playwright/test";

/**
 * Project creation + task assignment + completion.
 *
 * Critical: Chantel (GRM Inc) is the primary beta user. Do not break her
 * project workflows. Run these against a seeded contractor account, not hers.
 */

test.describe("Projects — create, add tasks, complete", () => {
  test.skip(true, "TODO: storage state for a non-Chantel test contractor.");

  test("contractor can create a new project", async ({ page }) => {
    await page.goto("/projects");
    // TODO: click "New project"
    // TODO: fill name, address, client, start date
    // TODO: save and assert the project appears in the list
  });

  test("contractor can add a task to a project and assign it", async ({
    page,
  }) => {
    // TODO: open a known seeded project
    // TODO: add a task with title + due date
    // TODO: assign to a team member
    // TODO: assert the task appears in the assignee's view
  });

  test("marking a task complete updates the project progress indicator", async ({
    page,
  }) => {
    // TODO: open a project with tasks
    // TODO: mark one task complete
    // TODO: assert the project's % complete bumped accordingly
  });
});
