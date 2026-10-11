import {expect, test} from "@playwright/test";

const pages = [
  ["/overview", "Operational overview"],
  ["/expeditions", "Expedition planning"],
  ["/personnel", "Personnel movement"],
  ["/cargo", "Cargo & logistics"],
  ["/cargo/scan", "Cargo QR Scanner"],
  ["/inventory", "Bharti Station Inventory"],
  ["/emergency", "Emergencies"],
];

test.describe("application smoke checks", () => {
  for (const [route, heading] of pages) {
    test(`${route} renders without browser or API errors`, async ({page}) => {
      const pageErrors = [];
      const apiFailures = [];

      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("response", (response) => {
        if (response.url().includes("/api/") && response.status() >= 400) {
          apiFailures.push(`${response.status()} ${response.url()}`);
        }
      });

      await page.goto(route);
      await expect(page.getByRole("heading", {name: heading, exact: true})).toBeVisible();
      await page.waitForLoadState("networkidle");

      expect(pageErrors).toEqual([]);
      expect(apiFailures).toEqual([]);
      await expect(page.getByText(/failed to (load|fetch)/i)).toHaveCount(0);
    });
  }

  test("core navigation remains usable on a phone viewport", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/overview");
    await expect(page.getByRole("heading", {name: "Operational overview"})).toBeVisible();
    await page.goto("/cargo");
    await expect(page.getByRole("heading", {name: "Cargo & logistics"})).toBeVisible();
    await expect(page.getByTitle("Scan cargo QR code")).toBeVisible();
  });
});
