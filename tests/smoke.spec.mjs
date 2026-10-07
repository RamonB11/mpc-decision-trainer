import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("dashboard loads with the primary training modules", async ({ page }) => {
  await expect(page).toHaveTitle(/MPC Decision Trainer/i);
  await expect(page.locator("#screen-formation")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Leader Development Dashboard" })).toBeVisible();
  await expect(page.locator("#openTdmModule")).toBeVisible();
  await expect(page.locator("#openExperimentalTop")).toBeVisible();
});

test("TDM can launch through the first decision and consequence", async ({ page }) => {
  await page.locator("#openTdmModule").click();
  await expect(page.locator("#screen-tdm-menu")).toBeVisible();

  const formationButtons = page.locator("#formationGrid .formation-card button");
  await expect(formationButtons.first()).toBeVisible();
  expect(await formationButtons.count()).toBeGreaterThan(0);
  await formationButtons.first().click();

  await expect(page.locator("#screen-menu")).toBeVisible();

  const scenarioButtons = page.locator("#scenarioGrid .scenario-card button");
  await expect(scenarioButtons.first()).toBeVisible();
  expect(await scenarioButtons.count()).toBeGreaterThan(0);
  await scenarioButtons.first().click();

  await expect(page.locator("#screen-mode")).toBeVisible();
  await page.locator('[data-mode="easy"]').click();

  await expect(page.locator("#screen-intro")).toBeVisible();
  await expect(page.locator("#introTitle")).not.toHaveText("");
  await page.locator("#beginBtn").click();

  await expect(page.locator("#screen-decision")).toBeVisible();
  const choices = page.locator("#choices .choice");
  await expect(choices.first()).toBeVisible();
  expect(await choices.count()).toBeGreaterThan(0);

  await choices.first().click();
  await expect(page.locator("#inlineConsequence")).toBeVisible();
  await expect(page.locator("#inlineContinueBtn")).toBeVisible();
});

test("progress export remains available", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportProgressBtn").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/MPC_Decision_Trainer_Progress.*\.json/i);
});
