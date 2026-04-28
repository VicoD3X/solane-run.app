import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.VITE_SMOKE_BASE_URL ?? "http://127.0.0.1:5173";
const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://localhost:8001";
const apiAvailable = apiBaseUrl ? await isApiAvailable(apiBaseUrl) : false;

const browser = await chromium.launch({ headless: true });

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await desktop.evaluate(() => document.fonts.ready);

  await expect(desktop).toHaveTitle("Solane Run");
  await expect(desktop.getByRole("link", { name: "Solane Run dashboard" })).toBeVisible();
  await expect(desktop.getByText("Freight parameters")).toBeVisible();
  await expect(desktop.getByText("Quote Input")).toHaveCount(0);
  await expect(desktop.getByText("Auto-calculated as inputs change.")).toBeVisible();
  await expect(desktop.getByRole("button", { name: "Calculate Run" })).toHaveCount(0);
  await expect(desktop.getByText("Road Overview")).toHaveCount(0);
  await expect(desktop.locator(".route-map-panel")).toHaveCount(0);
  await expect(desktop.locator(".road-overview")).toHaveCount(0);
  await expect(desktop.getByText("Quote Summary")).toHaveCount(0);
  await expect(desktop.getByText("Contract Review")).toBeVisible();
  await expect(desktop.getByText("BETA", { exact: true })).toBeVisible();
  await expect(desktop.getByText("Service Status")).toBeVisible();
  await expect(desktop.getByText("Active")).toBeVisible();
  await expect(desktop.getByText("Discord Server")).toBeVisible();
  await expect(desktop.getByText("Route Intel")).toBeVisible();
  await expect(desktop.getByText("My Run")).toBeVisible();
  await desktop.getByRole("button", { name: "Discord Server coming soon" }).click();
  await expect(desktop.getByText("Coming soon")).toBeVisible();
  await desktop.waitForTimeout(1400);
  await desktop.getByRole("button", { name: "Route Intel coming soon" }).click();
  await expect(desktop.getByText("Coming soon")).toBeVisible();
  await desktop.waitForTimeout(1400);
  await desktop.getByRole("button", { name: "My Run coming soon" }).click();
  await expect(desktop.getByText("Coming soon")).toBeVisible();
  await expect(desktop.getByText("Run Readiness")).toHaveCount(0);
  await expect(desktop.locator(".site-footer").getByText("Premium freight desk for New Eden")).toBeVisible();
  await expect(desktop.locator(".speed-toggle").getByRole("button", { name: /Normal/i })).toBeVisible();
  await expect(desktop.locator(".quote-lines")).toHaveCount(0);
  await expect(desktop.locator(".contract-packet").getByText("Route")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Speed")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Size")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Normal")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Contract to")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Collateral")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Rewards")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Expiration")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Days to complete")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Solane Run")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("3 days")).toHaveCount(2);
  await expect(desktop.getByRole("button", { name: "Copy Rewards" })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "Copy Collateral" })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "Copy Contract to" })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "Copy Expiration" })).toHaveCount(0);
  await expect(desktop.getByRole("button", { name: "Copy Days to complete" })).toHaveCount(0);
  await desktop.locator(".speed-toggle").getByRole("button", { name: /Normal/i }).click();
  await expect(desktop.locator(".contract-packet").getByText("Rush")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("1 day")).toHaveCount(2);
  await desktop.locator(".speed-toggle").getByRole("button", { name: /Rush/i }).click();
  await expect(desktop.locator(".contract-packet").getByText("Normal")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("3 days")).toHaveCount(2);
  await desktop.getByRole("button", { name: "Copy Contract to" }).click();
  await expect(desktop.getByRole("button", { name: "Copy Contract to" })).toBeVisible();
  if (apiAvailable) {
    await expect(desktop.getByText(/pilots/i)).toBeVisible({ timeout: 15000 });
  } else {
    await expect(desktop.getByText("syncing", { exact: true })).toBeVisible();
  }
  await expect(desktop.getByText("Public ESI Route")).toHaveCount(0);
  await expect(desktop.getByText("History")).toHaveCount(0);
  await expect(desktop.getByText("Public-only ESI scope")).toHaveCount(0);
  await expect(desktop.getByText("Demo pricing model")).toHaveCount(0);
  await expect(desktop.getByText("Route Mode")).toHaveCount(0);
  await expect(desktop.getByText("Saved Quotes")).toHaveCount(0);
  await expect(desktop.getByText("Settings")).toHaveCount(0);
  await desktop.waitForTimeout(1400);
  await expect(desktop.getByText("Coming soon")).toHaveCount(0);
  await expect(desktop.getByText("Local route")).toHaveCount(0);
  await expect(desktop.getByText("ESI synced")).toHaveCount(0);
  await expect(desktop.getByText("Pickup Service")).toHaveCount(0);
  await expect(desktop.getByText("Route Quality")).toHaveCount(0);
  await expect(desktop.getByText("Service Theme")).toHaveCount(0);
  await expect(desktop.getByText("Cargo Profile")).toHaveCount(0);
  await expect(desktop.getByText("Ops Window")).toHaveCount(0);
  await expect(desktop.getByText("X-RUSH")).toHaveCount(0);
  await expect(desktop.getByText("Route Source")).toHaveCount(0);
  await expect(desktop.getByText("Base run")).toHaveCount(0);
  await expect(desktop.getByText("Volume fee")).toHaveCount(0);
  await expect(desktop.getByText("Collateral band")).toHaveCount(0);
  await expect(desktop.getByText("Route modifier")).toHaveCount(0);
  await expect(desktop.locator(".fee-grid")).toHaveCount(0);
  await expect(desktop.locator(".telemetry-grid")).toHaveCount(0);
  await expect(desktop.getByRole("combobox", { name: "Pick Up" })).toHaveValue("");
  await expect(desktop.getByRole("combobox", { name: "Destination" })).toHaveValue("");
  await expect(desktop.getByRole("textbox", { name: "Volume" })).toHaveCount(0);
  await expect(desktop.getByRole("textbox", { name: "Collateral" })).toHaveValue("");
  await expect(desktop.getByRole("button", { name: "13,000 m3" })).toHaveCount(0);
  await expect(desktop.getByRole("button", { name: "60,000 m3" })).toHaveCount(0);
  await expect(desktop.getByRole("button", { name: "800,000 m3" })).toHaveCount(0);
  await expect(desktop.getByText("Set Pick Up and Destination to unlock cargo sizes.")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("60,000 m3")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("0 ISK")).toHaveCount(2);
  await desktop.getByRole("combobox", { name: "Pick Up" }).fill("Jita123");
  await expect(desktop.getByRole("combobox", { name: "Pick Up" })).toHaveValue("Jita");
  await desktop.getByRole("combobox", { name: "Pick Up" }).fill("");
  await desktop.getByRole("textbox", { name: "Collateral" }).fill("2.5B");
  await expect(desktop.getByRole("textbox", { name: "Collateral" })).toHaveValue("25");
  await desktop.getByRole("textbox", { name: "Collateral" }).fill("2500000000");
  await expect(desktop.locator(".contract-packet").getByText("2,500,000,000 ISK")).toBeVisible();
  await desktop.getByRole("textbox", { name: "Collateral" }).fill("6000000000");
  await expect(desktop.getByRole("textbox", { name: "Collateral" })).toHaveValue("6 000 000 000");
  await expect(desktop.getByRole("status")).toHaveText("Collateral limit exceeded. Maximum allowed is 5,000,000,000 ISK.");
  await expect(desktop.locator(".contract-packet").getByText("Blocked")).toBeVisible();
  await expect(desktop.getByRole("button", { name: "Copy Rewards" })).toHaveCount(0);
  await desktop.getByRole("textbox", { name: "Collateral" }).fill("200000000");
  await expect(desktop.getByRole("textbox", { name: "Collateral" })).toHaveValue("200 000 000");
  await expect(desktop.getByText("Collateral limit exceeded. Maximum allowed is 5,000,000,000 ISK.")).toHaveCount(0);
  await expect(desktop.getByRole("button", { name: "Copy Rewards" })).toBeVisible();

  const serviceAccent = await desktop.locator(".app-shell").evaluate((node) =>
    getComputedStyle(node).getPropertyValue("--service-accent").trim(),
  );
  if (serviceAccent.toLowerCase() !== "#a855f7") {
    throw new Error(`Expected fixed Solane accent #a855f7, got ${serviceAccent}`);
  }

  if (apiAvailable) {
    await desktop.getByRole("combobox", { name: "Pick Up" }).fill("Jita");
    await desktop.getByRole("option", { name: /Jita/i }).click();
    await desktop.getByRole("combobox", { name: "Destination" }).fill("Amarr");
    await desktop.getByRole("option", { name: /Amarr/i }).click();
    await expect(desktop.getByRole("button", { name: "13,000 m3" })).toBeVisible();
    await expect(desktop.getByRole("button", { name: "60,000 m3" })).toBeVisible();
    await expect(desktop.getByRole("button", { name: "800,000 m3" })).toBeVisible();
    await expect(desktop.getByText("Set Pick Up and Destination to unlock cargo sizes.")).toHaveCount(0, { timeout: 2000 });
    await expect(desktop.locator(".contract-packet").getByText("Jita - Amarr")).toBeVisible();
    await expect(desktop.getByText("Road Overview")).toBeVisible();
    await expect(desktop.locator(".road-overview")).toBeVisible();
    await expect(desktop.getByText("Total jumps")).toBeVisible();
    await expect(desktop.getByText("Route Traffic")).toBeVisible();
    await expect(desktop.getByText("Contract Acceptance")).toBeVisible();
    await expect(desktop.getByText("Route Risk")).toBeVisible();
    await expect(desktop.getByText(/Corp queue (synced|syncing)/i)).toBeVisible();
    await expect(desktop.locator(".road-intel-card").getByText(/Express|Fast|Normal|Slower|Extended|Syncing/)).toBeVisible();
    await expect(desktop.locator(".road-intel-card").getByText(/Nominal|Watched|Hot|Flashpoint|Restricted|Unavailable/)).toBeVisible();
    await expect(desktop.getByText("Security bands")).toBeVisible();
    await expect(desktop.locator(".road-intel-card small").filter({ hasText: /jumps last hour/i })).toBeVisible();
    await expect(desktop.locator(".road-system-cell").first()).toBeVisible({ timeout: 15000 });
    const roadCellCount = await desktop.locator(".road-system-cell").count();
    if (roadCellCount < 2) {
      throw new Error(`Expected at least two road cells, got ${roadCellCount}`);
    }
    await desktop.locator(".road-system-cell").first().hover();
    await expect(desktop.locator(".road-system-tooltip").first()).toContainText(/Security|Traffic unavailable|jumps last hour/i);
    await desktop.waitForFunction(() => {
      const text = document.querySelector(".contract-packet")?.textContent ?? "";
      return !text.includes("0 jumps");
    }, null, { timeout: 15000 });
    await desktop.waitForFunction(() => {
      const rewardRow = [...document.querySelectorAll(".packet-row")]
        .find((row) => row.textContent?.includes("Rewards"));
      const text = rewardRow?.textContent ?? "";
      return !text.includes("Rewards0 ISK") && !text.includes("Blocked");
    }, null, { timeout: 15000 });
    await desktop.locator(".speed-toggle").getByRole("button", { name: /Normal/i }).click();
    await expect(desktop.locator(".quote-lock-message")).toHaveText("Rush pricing is coming soon.", { timeout: 15000 });
    await expect(desktop.getByRole("button", { name: "Copy Rewards" })).toHaveCount(0);
    await desktop.locator(".speed-toggle").getByRole("button", { name: /Rush/i }).click();
    await expect(desktop.locator(".quote-lock-message")).toHaveCount(0, { timeout: 15000 });
    await desktop.getByRole("button", { name: "800,000 m3" }).click();
    await expect(desktop.locator(".contract-packet").getByText("800,000 m3")).toBeVisible();
    await expect(desktop.getByText("3 500 000 000 ISK")).toBeVisible({ timeout: 15000 });
    await desktop.getByRole("textbox", { name: "Collateral" }).fill("4000000000");
    await expect(desktop.getByRole("status")).toHaveText("Collateral limit exceeded. Maximum allowed is 3,500,000,000 ISK.", { timeout: 15000 });
    await desktop.getByRole("textbox", { name: "Collateral" }).fill("200000000");
    await desktop.waitForFunction(() => {
      const text = document.querySelector(".contract-packet")?.textContent ?? "";
      return text.includes("200,000,000 ISK");
    }, null, { timeout: 15000 });
  }

  const desktopOverflow = await desktop.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (desktopOverflow > 1) {
    throw new Error(`Desktop horizontal overflow detected: ${desktopOverflow}px`);
  }
  const desktopVerticalOverflow = await desktop.evaluate(
    () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
  );
  if (desktopVerticalOverflow > 1) {
    throw new Error(`Desktop vertical overflow detected: ${desktopVerticalOverflow}px`);
  }
  await desktop.waitForTimeout(1200);
  await desktop.screenshot({ path: "dev.logs/desktop.png", fullPage: true });
  if (apiAvailable) {
    await desktop.getByRole("button", { name: "Clear Destination" }).click();
    await expect(desktop.locator(".size-reveal-closing")).toBeVisible({ timeout: 1000 });
    await expect(desktop.locator(".road-overview-closing")).toBeVisible({ timeout: 1000 });
    await expect(desktop.locator(".copyable-value em.route-meta-closing")).toBeVisible({ timeout: 1000 });
    await expect(desktop.getByRole("button", { name: "13,000 m3" })).toHaveCount(0, { timeout: 2000 });
    await expect(desktop.getByText("Set Pick Up and Destination to unlock cargo sizes.")).toBeVisible({ timeout: 2000 });
    await expect(desktop.locator(".road-overview")).toHaveCount(0, { timeout: 2000 });
    await expect(desktop.locator(".contract-packet").getByText("Jita - Amarr")).toHaveCount(0, { timeout: 2000 });
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await mobile.evaluate(() => document.fonts.ready);
  await expect(mobile.getByRole("link", { name: "Solane Run dashboard" })).toBeVisible();
  await expect(mobile.getByText("Freight parameters")).toBeVisible();
  await expect(mobile.getByText("Road Overview")).toHaveCount(0);
  await expect(mobile.getByText("Quote Summary")).toHaveCount(0);
  await expect(mobile.getByText("Contract Review")).toBeVisible();
  await expect(mobile.getByRole("combobox", { name: "Pick Up" })).toHaveValue("");
  await expect(mobile.getByText("Set Pick Up and Destination to unlock cargo sizes.")).toBeVisible();

  const mobileOverflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (mobileOverflow > 1) {
    throw new Error(`Mobile horizontal overflow detected: ${mobileOverflow}px`);
  }
  await mobile.screenshot({ path: "dev.logs/mobile.png", fullPage: true });
} finally {
  await browser.close();
}

async function isApiAvailable(apiUrl) {
  try {
    const response = await fetch(`${apiUrl}/api/eve/status`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}
