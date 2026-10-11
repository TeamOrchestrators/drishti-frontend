import {expect, test} from "@playwright/test";

const hour = 60 * 60 * 1000;
const day = 24 * hour;

function localDateTime(instant) {
  const date = new Date(instant);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function control(page, label) {
  const exactLabel = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  return page
    .locator("label")
    .filter({has: page.locator("span").filter({hasText: exactLabel})})
    .locator("input, select, textarea")
    .first();
}

async function loadPlanningData(request) {
  const [formResponse, personnelResponse] = await Promise.all([
    request.get("/api/expeditions/form-options"),
    request.get("/api/personnel"),
  ]);
  expect(formResponse.ok()).toBeTruthy();
  expect(personnelResponse.ok()).toBeTruthy();

  const form = await formResponse.json();
  const personnel = await personnelResponse.json();
  const origin = form.stations.find((station) => station.code === "BHARTI");
  const destination = form.stations.find((station) => station.code === "MAITRI");
  const assignedEligible = personnel.total_personnel.find(
    (person) => person.name === "Dr. Ishita Sen" && person.status === "assigned",
  );
  const teamLeader = personnel.total_personnel.find(
    (person) => person.name === "Dr. Ananya Rao",
  );

  expect(origin).toBeTruthy();
  expect(destination).toBeTruthy();
  expect(assignedEligible).toBeTruthy();
  expect(teamLeader).toBeTruthy();
  return {form, personnel, origin, destination, assignedEligible, teamLeader};
}

test.describe.serial("expedition planning and personnel assignment", () => {
  test("expedition API rejects invalid route, date order, and status", async ({request}) => {
    const {origin, destination, teamLeader} = await loadPlanningData(request);
    const start = new Date(Date.now() + 10 * day);
    const end = new Date(start.getTime() + 2 * day);
    const base = {
      expedition_code: `EXP-PW-RULES-${Date.now()}`,
      name: "Playwright rule validation",
      purpose: "Verify expedition invariants",
      origin_station_id: origin.id,
      destination_station_id: destination.id,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      team_leader_id: teamLeader.personnel_id,
      status: "planned",
    };

    const sameStation = await request.post("/api/expeditions", {
      data: {...base, destination_station_id: origin.id},
    });
    expect(sameStation.status()).toBe(400);
    expect(await sameStation.text()).toContain("origin and destination stations must differ");

    const invertedDates = await request.post("/api/expeditions", {
      data: {...base, expedition_code: `${base.expedition_code}-DATE`, start_date: end.toISOString(), end_date: start.toISOString()},
    });
    expect(invertedDates.status()).toBe(400);
    expect(await invertedDates.text()).toContain("end_date must not be before start_date");

    const invalidStatus = await request.post("/api/expeditions", {
      data: {...base, expedition_code: `${base.expedition_code}-STATUS`, status: "boarding"},
    });
    expect(invalidStatus.status()).toBe(400);
    expect(await invalidStatus.text()).toContain("invalid expedition status");
  });

  test("user can create an expedition and assign eligible stationed personnel", async ({page, request}) => {
    const {origin, destination, assignedEligible, teamLeader} = await loadPlanningData(request);
    const start = new Date(Date.now() + 14 * day);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 3 * day);
    const startLocal = localDateTime(start);
    const endLocal = localDateTime(end);
    const expeditionName = `Playwright Traverse ${Date.now()}`;
    let createRequest;

    page.on("request", (outgoing) => {
      if (outgoing.method() === "POST" && outgoing.url().endsWith("/api/expeditions")) {
        createRequest = outgoing;
      }
    });

    await page.goto("/expeditions");
    await page.getByRole("button", {name: "New expedition"}).click();

    const codeInput = control(page, "Expedition code");
    const expeditionCode = await codeInput.inputValue();
    expect(expeditionCode).toMatch(/^EXP-\d+$/);
    await control(page, "Expedition name").fill(expeditionName);
    await control(page, "Purpose").fill("Automated traverse workflow verification");

    const originSelect = control(page, "Origin station");
    const destinationSelect = control(page, "Destination station");
    const leaderSelect = control(page, "Team leader");
    await expect(leaderSelect).toBeDisabled();
    await originSelect.selectOption(origin.id);
    await expect(leaderSelect).toBeEnabled();
    await leaderSelect.selectOption(teamLeader.personnel_id);

    // Changing the origin invalidates a previously selected leader from another station.
    await originSelect.selectOption(destination.id);
    await expect(leaderSelect).toHaveValue("");
    await originSelect.selectOption(origin.id);
    await leaderSelect.selectOption(teamLeader.personnel_id);
    await destinationSelect.selectOption(destination.id);

    const startInput = control(page, "Start date and time");
    const endInput = control(page, "End date and time");
    await startInput.fill(startLocal);
    await expect(endInput).toHaveAttribute("min", startLocal);

    // Entering an end before the start is cleared immediately by frontend state logic.
    await endInput.fill(localDateTime(start.getTime() - hour));
    await expect(endInput).toHaveValue("");
    await endInput.fill(endLocal);
    await expect(startInput).toHaveAttribute("max", endLocal);
    await control(page, "Status").selectOption("planned");
    await page.getByRole("button", {name: "Create expedition"}).click();

    await expect(page.getByRole("heading", {name: "Create expedition"})).toHaveCount(0);
    await expect(page.getByText(expeditionName, {exact: true})).toBeVisible();
    expect(createRequest).toBeTruthy();
    const emitted = createRequest.postDataJSON();
    expect(emitted.expedition_code).toBe(expeditionCode);
    expect(emitted.origin_station_id).toBe(origin.id);
    expect(emitted.destination_station_id).toBe(destination.id);
    expect(new Date(emitted.start_date).getTime()).toBe(start.getTime());
    expect(new Date(emitted.end_date).getTime()).toBe(end.getTime());

    const expeditions = await (await request.get("/api/expeditions")).json();
    const created = expeditions.find((expedition) => expedition.expedition_code === expeditionCode);
    expect(created).toBeTruthy();

    const tooEarly = await request.post("/api/personnel/expedition-assignment", {
      data: {
        expedition_id: created.id,
        personnel_id: assignedEligible.personnel_id,
        origin_station_id: origin.id,
        destination_station_id: destination.id,
        departure_time: new Date(start.getTime() - hour).toISOString(),
        arrival_time: end.toISOString(),
        movement_status: "planned",
      },
    });
    expect(tooEarly.status()).toBe(400);

    const wrongOrigin = await request.post("/api/personnel/expedition-assignment", {
      data: {
        expedition_id: created.id,
        personnel_id: assignedEligible.personnel_id,
        origin_station_id: destination.id,
        destination_station_id: origin.id,
        departure_time: start.toISOString(),
        arrival_time: end.toISOString(),
        movement_status: "planned",
      },
    });
    expect(wrongOrigin.status()).toBe(400);

    await page.goto("/personnel");
    await page.getByRole("button", {name: "Assign personnel"}).click();
    await control(page, "Expedition").selectOption(created.id);

    const departureInput = control(page, "Departure date and time");
    const arrivalInput = control(page, "Arrival date and time");
    await expect(control(page, "Origin station (auto-filled)")).toHaveValue(origin.id);
    await expect(control(page, "Destination station (auto-filled)")).toHaveValue(destination.id);
    await expect(departureInput).toHaveAttribute("min", startLocal);
    await expect(departureInput).toHaveAttribute("max", endLocal);
    await expect(arrivalInput).toHaveAttribute("max", endLocal);
    await expect(departureInput).toHaveValue(startLocal);
    await expect(arrivalInput).toHaveValue(endLocal);

    const personnelSelect = control(page, "Personnel to assign");
    await expect(personnelSelect.locator(`option[value="${assignedEligible.personnel_id}"]`)).toContainText(
      "Dr. Ishita Sen",
    );
    await personnelSelect.selectOption(assignedEligible.personnel_id);
    await control(page, "Movement status").selectOption("planned");
    await page.getByRole("button", {name: "Assign personnel", exact: true}).last().click();

    await expect(page.getByRole("heading", {name: "Assign personnel to expedition movement"})).toHaveCount(0);
    await expect(page.getByText("Dr. Ishita Sen", {exact: true}).first()).toBeVisible();

    const personnelPayload = await (await request.get("/api/personnel")).json();
    const movement = personnelPayload.moving_personnel.find(
      (person) => person.personnel_id === assignedEligible.personnel_id,
    );
    expect(movement).toBeTruthy();
    expect(movement.status).toBe("planned");

    const duplicateMovement = await request.post("/api/personnel/expedition-assignment", {
      data: {
        expedition_id: created.id,
        personnel_id: assignedEligible.personnel_id,
        origin_station_id: origin.id,
        destination_station_id: destination.id,
        departure_time: start.toISOString(),
        arrival_time: end.toISOString(),
        movement_status: "planned",
      },
    });
    expect(duplicateMovement.status()).toBe(400);
    expect(await duplicateMovement.text()).toContain("assignment is not eligible");
  });

  test("completed expeditions are not offered for new personnel assignments", async ({page}) => {
    await page.goto("/personnel");
    await page.getByRole("button", {name: "Assign personnel"}).click();
    await expect(
      control(page, "Expedition").locator("option", {hasText: "Maitri Winter Logistics Support"}),
    ).toHaveCount(0);
  });
});
