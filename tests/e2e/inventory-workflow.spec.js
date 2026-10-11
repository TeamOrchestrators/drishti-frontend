import {expect, test} from "@playwright/test";

function control(page, label) {
  const exactLabel = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  return page
    .locator("label")
    .filter({has: page.locator("span").filter({hasText: exactLabel})})
    .locator("input, select, textarea")
    .first();
}

test.describe.serial("inventory management", () => {
  test("item creation validates thresholds and stock adjustments preserve invariants", async ({page, request}) => {
    const itemCode = `PW-${Date.now()}`;
    const itemName = `Playwright thermal packs ${Date.now()}`;
    const stationOptions = await (await request.get("/api/expeditions/form-options")).json();
    const stationId = stationOptions.stations.find((station) => station.code === "BHARTI").id;

    await page.goto("/inventory");
    await page.getByRole("button", {name: "Add item"}).first().click();
    await control(page, "Item code").fill(itemCode);
    await control(page, "Item name").fill(itemName);
    await control(page, "Category").fill("field_support");
    await control(page, "Unit").fill("packs");
    await control(page, "Opening quantity").fill("10");
    await control(page, "Minimum quantity").fill("5");
    await control(page, "Maximum quantity (optional)").fill("4");
    await page.getByRole("button", {name: "Add item", exact: true}).last().click();
    await expect(page.getByText("Maximum quantity cannot be less than minimum quantity.")).toBeVisible();

    await control(page, "Maximum quantity (optional)").fill("20");
    await control(page, "Notes (optional)").fill("Created by the browser workflow suite");
    await page.getByRole("button", {name: "Add item", exact: true}).last().click();
    await expect(page.getByText(itemName, {exact: true}).first()).toBeVisible();

    const initialPayload = await (await request.get(`/api/inventory?station_id=${stationId}`)).json();
    const created = initialPayload.items.find((item) => item.item_code === itemCode);
    expect(created).toBeTruthy();
    expect(created.on_hand_quantity).toBe(10);
    expect(created.minimum_quantity).toBe(5);
    expect(created.maximum_quantity).toBe(20);

    const addResponse = await request.post(
      `/api/stations/${stationId}/inventory/${created.inventory_id}/stock`,
      {data: {operation: "add", quantity: 5, notes: "Playwright replenishment"}},
    );
    expect(addResponse.ok(), await addResponse.text()).toBeTruthy();

    const invalidOperation = await request.post(
      `/api/stations/${stationId}/inventory/${created.inventory_id}/stock`,
      {data: {operation: "replace", quantity: 1}},
    );
    expect(invalidOperation.status()).toBe(400);
    expect(await invalidOperation.text()).toContain("operation must be add or remove");

    const zeroQuantity = await request.post(
      `/api/stations/${stationId}/inventory/${created.inventory_id}/stock`,
      {data: {operation: "add", quantity: 0}},
    );
    expect(zeroQuantity.status()).toBe(400);
    expect(await zeroQuantity.text()).toContain("quantity must be greater than zero");

    const overdraw = await request.post(
      `/api/stations/${stationId}/inventory/${created.inventory_id}/stock`,
      {data: {operation: "remove", quantity: 1000}},
    );
    expect(overdraw.status()).toBe(400);

    const refreshed = await (await request.get(`/api/inventory?station_id=${stationId}`)).json();
    const adjusted = refreshed.items.find((item) => item.inventory_id === created.inventory_id);
    expect(adjusted.on_hand_quantity).toBe(15);
    expect(
      refreshed.history.some(
        (entry) => entry.item_name === itemName && entry.notes === "Playwright replenishment" && entry.on_hand_delta === 5,
      ),
    ).toBeTruthy();

    const refreshResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes(`/api/inventory?station_id=${stationId}`),
    );
    await page.getByTitle("Refresh inventory").click();
    await refreshResponse;
    const card = page
      .getByRole("button", {name: "Remove stock"})
      .locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' rounded-lg ')][1]")
      .filter({hasText: itemName});
    await expect(card).toContainText("15 on-hand");
    await card.getByRole("button", {name: "Remove stock"}).click();
    const quantityInput = control(page, "Quantity to remove");
    await quantityInput.fill("1000");
    await quantityInput.locator("xpath=ancestor::form").getByRole("button", {name: "Confirm removal"}).click();
    await expect(page.getByText(/Available quantity is only 15 packs/)).toBeVisible();
  });

  test("inventory API rejects malformed item quantities", async ({request}) => {
    const stationOptions = await (await request.get("/api/expeditions/form-options")).json();
    const stationId = stationOptions.stations.find((station) => station.code === "BHARTI").id;
    const response = await request.post(
      `/api/inventory/items?station_id=${stationId}`,
      {
        data: {
          item_code: `PW-BAD-${Date.now()}`,
          name: "Invalid thresholds",
          category: "test",
          unit: "units",
          is_critical: false,
          opening_quantity: -1,
          minimum_quantity: 10,
          maximum_quantity: 5,
        },
      },
    );
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain("invalid inventory quantities");
  });
});
