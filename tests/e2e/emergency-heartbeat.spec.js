import {expect, test} from "@playwright/test";

function heartbeat(latitude, longitude) {
  return {
    idempotency_key: crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
    latitude,
    longitude,
    location_accuracy_m: 6,
    altitude_m: 24,
    heading_deg: 142,
    speed_mps: 1.4,
    battery_percent: 92,
  };
}

test("an open emergency view follows device heartbeat coordinates", async ({page, request}) => {
  test.setTimeout(40_000);

  const optionsResponse = await request.get("/api/emergency/device/simulate/form-options");
  expect(optionsResponse.ok()).toBeTruthy();
  const options = await optionsResponse.json();
  const personnel = options.personnel?.[0];
  expect(personnel, "test data should expose a personnel member for the simulator").toBeTruthy();

  const registerResponse = await request.post("/api/emergency/device/simulate/register", {
    data: {
      personnel_id: personnel.personnel_id,
      device_label: `PW-E2E-${Date.now()}`,
    },
  });
  expect(registerResponse.ok(), await registerResponse.text()).toBeTruthy();
  const device = await registerResponse.json();

  // The backend stores coordinates at millidegree precision.
  const initialPosition = [-69.555, 76.333];
  const movedPosition = [-69.556, 76.338];
  const firstHeartbeat = await request.post(
    `/api/emergency/device/simulate/${device.device_id}/heartbeat`,
    {data: heartbeat(...initialPosition)},
  );
  expect(firstHeartbeat.ok(), await firstHeartbeat.text()).toBeTruthy();

  const initiateResponse = await request.post(
    `/api/emergency/device/simulate/${device.device_id}/sos/initiate`,
    {
      data: {
        emergency_type: "medical",
        severity: "immediate_response",
        summary: "Playwright live-location verification",
      },
    },
  );
  expect(initiateResponse.ok(), await initiateResponse.text()).toBeTruthy();
  const confirmation = await initiateResponse.json();

  const confirmResponse = await request.post(
    `/api/emergency/device/simulate/${device.device_id}/sos/${confirmation.confirmation_id}/confirm`,
    {data: {idempotency_key: crypto.randomUUID()}},
  );
  expect(confirmResponse.ok(), await confirmResponse.text()).toBeTruthy();
  const emergency = await confirmResponse.json();

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/emergency");
  await expect(page.getByText(emergency.emergency_code, {exact: true})).toBeVisible();
  await expect(page.getByText("69.555000° S, 76.333000° E", {exact: true}).first()).toBeVisible();

  const movedHeartbeat = await request.post(
    `/api/emergency/device/simulate/${device.device_id}/heartbeat`,
    {data: heartbeat(...movedPosition)},
  );
  expect(movedHeartbeat.ok(), await movedHeartbeat.text()).toBeTruthy();

  await expect(page.getByText("69.556000° S, 76.338000° E", {exact: true}).first()).toBeVisible({
    timeout: 20_000,
  });
  expect(pageErrors).toEqual([]);
  await expect(page.getByText(/maximum update depth exceeded/i)).toHaveCount(0);
});
