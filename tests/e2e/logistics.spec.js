import {expect, test} from "@playwright/test";

test.describe.serial("cargo and shipment logic", () => {
  test("split shipments retain independent routes and chronological checkpoints", async ({request}) => {
    const cargoResponse = await request.get("/api/cargo");
    expect(cargoResponse.ok()).toBeTruthy();
    const cargoPayload = await cargoResponse.json();

    expect(cargoPayload.cargo.length).toBeGreaterThan(0);
    expect(cargoPayload.batches.length).toBeGreaterThan(0);

    const trackedBatches = await Promise.all(
      cargoPayload.batches.map(async (batch) => {
        const response = await request.get(`/api/logistics-batches/${batch.id}/tracking`);
        expect(response.ok()).toBeTruthy();
        return response.json();
      }),
    );
    const splitBatch = trackedBatches.find((batch) => batch.shipments?.length >= 2);

    expect(splitBatch, "seed data should include a split-route logistics batch").toBeTruthy();
    expect(new Set(splitBatch.shipments.map((shipment) => shipment.id)).size).toBe(
      splitBatch.shipments.length,
    );
    expect(new Set(splitBatch.shipments.map((shipment) => shipment.transport_mode)).size).toBeGreaterThan(1);

    for (const shipment of splitBatch.shipments) {
      const timestamps = (shipment.checkpoints || []).map((checkpoint) =>
        new Date(checkpoint.scanned_at).getTime(),
      );
      expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    }
  });

  test("logistics API rejects invalid routes, windows, scans, and splits", async ({request}) => {
    const [expeditionsResponse, formResponse, cargoResponse] = await Promise.all([
      request.get("/api/expeditions"),
      request.get("/api/expeditions/form-options"),
      request.get("/api/cargo"),
    ]);
    const expeditions = await expeditionsResponse.json();
    const form = await formResponse.json();
    const logistics = await cargoResponse.json();
    const expedition = expeditions.find((item) => item.expedition_code === "EXP-ANT-001");
    const batch = logistics.batches.find((item) => item.batch_code === "BATCH-ANT-001");
    const cargo = logistics.cargo.find((item) => item.cargo_code === "CG-ANT-002");
    const origin = form.stations.find((station) => station.code === "BHARTI");
    const destination = form.stations.find((station) => station.code === "MAITRI");
    expect(expedition && batch && cargo && origin && destination).toBeTruthy();

    const expeditionStart = new Date(expedition.start_date);
    const expeditionEnd = new Date(expedition.end_date);
    const insideStart = new Date(expeditionStart.getTime() + 60 * 60 * 1000);
    const insideEnd = new Date(expeditionEnd.getTime() - 60 * 60 * 1000);

    const beforeWindow = await request.post("/api/logistics-batches", {
      data: {
        batch_code: `PW-BATCH-BEFORE-${Date.now()}`,
        expedition_id: expedition.id,
        status: "planned",
        planned_dispatch_at: new Date(expeditionStart.getTime() - 1).toISOString(),
        estimated_arrival_at: insideEnd.toISOString(),
      },
    });
    expect(beforeWindow.status()).toBe(400);
    expect(await beforeWindow.text()).toContain("before the expedition start");

    const afterWindow = await request.post("/api/logistics-batches", {
      data: {
        batch_code: `PW-BATCH-AFTER-${Date.now()}`,
        expedition_id: expedition.id,
        status: "planned",
        planned_dispatch_at: insideStart.toISOString(),
        estimated_arrival_at: new Date(expeditionEnd.getTime() + 1).toISOString(),
      },
    });
    expect(afterWindow.status()).toBe(400);
    expect(await afterWindow.text()).toContain("after the expedition end");

    const invalidShipmentMode = await request.post(`/api/logistics-batches/${batch.id}/shipments`, {
      data: {
        shipment_code: `PW-SHIP-${Date.now()}`,
        transport_mode: "teleport",
        priority: "standard",
        status: "planned",
        planned_dispatch_at: insideStart.toISOString(),
        estimated_arrival_at: insideEnd.toISOString(),
      },
    });
    expect(invalidShipmentMode.status()).toBe(400);
    expect(await invalidShipmentMode.text()).toContain("invalid shipment transport_mode");

    const sameStationCargo = await request.post("/api/cargo", {
      data: {
        cargo_code: `PW-CARGO-${Date.now()}`,
        origin_station_id: origin.id,
        destination_station_id: origin.id,
        priority: "standard",
        status: "draft",
      },
    });
    expect(sameStationCargo.status()).toBe(400);
    expect(await sameStationCargo.text()).toContain("origin and destination stations must differ");

    const assignedDuringCreate = await request.post("/api/cargo", {
      data: {
        cargo_code: `PW-CARGO-BATCH-${Date.now()}`,
        origin_station_id: origin.id,
        destination_station_id: destination.id,
        logistics_batch_id: batch.id,
        priority: "standard",
        status: "draft",
      },
    });
    expect(assignedDuringCreate.status()).toBe(400);
    expect(await assignedDuringCreate.text()).toContain("create cargo without logistics_batch_id");

    const missingCoordinates = await request.post(`/api/cargo/qr/${cargo.id}/scan`, {
      data: {event_type: "scanned", latitude: -69.408, scope: "cargo"},
    });
    expect(missingCoordinates.status()).toBe(400);
    expect(await missingCoordinates.text()).toContain("latitude and longitude are required");

    const invalidScope = await request.post(`/api/cargo/qr/${cargo.id}/scan`, {
      data: {event_type: "scanned", latitude: -69.408, longitude: 76.19, scope: "fleet"},
    });
    expect(invalidScope.status()).toBe(400);
    expect(await invalidScope.text()).toContain("scope must be cargo, shipment, or batch");

    const detail = await (await request.get(`/api/cargo/qr/${cargo.id}`)).json();
    const sourceItem = detail.items[0];
    const excessiveSplit = await request.post(`/api/cargo/${cargo.id}/split`, {
      data: {
        new_cargo_code: `PW-SPLIT-${Date.now()}`,
        priority: "critical",
        items: [{item_id: sourceItem.item_id, quantity: sourceItem.quantity + 1_000_000}],
      },
    });
    expect(excessiveSplit.status()).toBe(400);
    expect(await excessiveSplit.text()).toContain("requested quantities or shipment are not valid");
  });

  test("cargo scan proxy emits the accepted JSON contract and content type", async ({page, request}) => {
    const cargoPayload = await (await request.get("/api/cargo")).json();
    const target = cargoPayload.cargo.find((cargo) => cargo.cargo_code === "CG-ANT-003") || cargoPayload.cargo[0];
    const sentBody = {
      event_type: "scanned",
      latitude: -69.408,
      longitude: 76.19,
      notes: "Playwright contract verification",
      scope: "cargo",
      apply_to_batch: false,
    };

    let emittedRequest;
    page.on("request", (outgoing) => {
      if (outgoing.url().includes(`/api/cargo/qr/${target.id}/scan`)) {
        emittedRequest = outgoing;
      }
    });
    await page.goto("/cargo/scan");
    const result = await page.evaluate(async ({targetId, body}) => {
      const response = await fetch(`/api/cargo/qr/${targetId}/scan`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
      });
      return {ok: response.ok, status: response.status, text: await response.text()};
    }, {targetId: target.id, body: sentBody});

    expect(result.ok, `${result.status}: ${result.text}`).toBeTruthy();
    expect(emittedRequest).toBeTruthy();
    expect(emittedRequest.headers()["content-type"]).toContain("application/json");
    expect(emittedRequest.postDataJSON()).toEqual(sentBody);

    const refreshed = await request.get(`/api/cargo/qr/${target.id}`);
    expect(refreshed.ok()).toBeTruthy();
    const refreshedCargo = await refreshed.json();
    const scans =
      refreshedCargo.scan_history ||
      refreshedCargo.qr_scans ||
      refreshedCargo.scans ||
      refreshedCargo.checkpoints ||
      [];
    expect(scans.some((scan) => scan.notes === sentBody.notes)).toBeTruthy();
  });

  test("cargo UI formats enums and QR copy provides feedback", async ({page}) => {
    await page.goto("/cargo");
    await expect(page.getByRole("heading", {name: "Cargo & logistics"})).toBeVisible();
    const cargoRow = page.locator("tr", {hasText: "CG-ANT-002"});
    await expect(cargoRow).toContainText("Ground");
    await expect(cargoRow).toContainText("High");
    await expect(cargoRow).not.toContainText("partially_dispatched");
    await expect(page.getByText("Partially Dispatched", {exact: true}).first()).toBeVisible();

    await cargoRow.getByTitle(/View & print QR label/).click();

    const token = (await page.getByText("Cargo UUID / QR Token").locator("..").locator("span").nth(1).textContent())?.trim();
    expect(token).toBeTruthy();

    await page.getByTitle("Copy UUID to clipboard").click();
    await expect(page.getByRole("button", {name: "Copied!"})).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(token);

    await expect(page.locator("#drishti-cargo-print-label")).not.toContainText("Current Status");
  });

  test("creation forms expose date-time controls and preserve expedition minimums", async ({page}) => {
    await page.goto("/expeditions");
    await page.getByRole("button", {name: /new expedition/i}).click();
    const expeditionDateTimes = page.locator('input[type="datetime-local"]');
    await expect(expeditionDateTimes).toHaveCount(2);

    await page.goto("/cargo");
    await page.getByRole("button", {name: "New Logistics Batch"}).first().click();
    await page.getByLabel("Assigned expedition (required)").selectOption({index: 1});
    const batchDateTimes = page.locator('input[type="datetime-local"]');
    await expect(batchDateTimes).toHaveCount(2);
    const minimums = await batchDateTimes.evaluateAll((inputs) => inputs.map((input) => input.min));
    expect(minimums.every(Boolean)).toBeTruthy();

    await page.goto("/personnel");
    await page.getByRole("button", {name: "Assign personnel"}).click();
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await expect(page.locator('input[type="datetime-local"]')).toHaveCount(2);
  });
});
