import { chromium, expect } from "@playwright/test";

const baseUrl = "http://127.0.0.1:5173";

const browser = await chromium.launch({ headless: true });

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  await desktop.evaluate(() => document.fonts.ready);

  await expect(desktop).toHaveTitle("Solane Run");
  await expect(desktop.getByRole("link", { name: "Solane Run dashboard" })).toBeVisible();
  await expect(desktop.getByText("Freight parameters")).toBeVisible();
  await expect(desktop.getByText("Route Overview")).toHaveCount(0);
  await expect(desktop.locator(".route-map-panel")).toHaveCount(0);
  await expect(desktop.getByText("Quote Summary")).toBeVisible();
  await expect(desktop.getByText("BETA", { exact: true })).toBeVisible();
  await expect(desktop.getByText("Service Status")).toBeVisible();
  await expect(desktop.getByText("Active")).toBeVisible();
  await expect(desktop.getByText("Discord Server")).toBeVisible();
  await expect(desktop.getByText("Run Readiness")).toHaveCount(0);
  await expect(desktop.locator(".site-footer").getByText("Premium freight desk for New Eden")).toBeVisible();
  await expect(desktop.locator(".speed-toggle").getByRole("button", { name: /Rush/i })).toBeVisible();
  await expect(desktop.locator(".quote-lines").getByText("Speed")).toBeVisible();
  await expect(desktop.locator(".quote-lines").getByText("Rush")).toBeVisible();
  await expect(desktop.getByText("Contract Packet")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Contract to")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Reward")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Collateral")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Expiration")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Completion")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("Solane Run")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("1 day")).toHaveCount(2);
  await expect(desktop.getByRole("button", { name: "Copy Reward" })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "Copy Collateral" })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "Copy Contract to" })).toBeVisible();
  await expect(desktop.getByRole("button", { name: "Copy Expiration" })).toHaveCount(0);
  await expect(desktop.getByRole("button", { name: "Copy Completion" })).toHaveCount(0);
  await desktop.locator(".speed-toggle").getByRole("button", { name: /Rush/i }).click();
  await expect(desktop.locator(".quote-lines").getByText("Normal")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("3 days")).toHaveCount(2);
  await desktop.locator(".speed-toggle").getByRole("button", { name: /Normal/i }).click();
  await expect(desktop.locator(".quote-lines").getByText("Rush")).toBeVisible();
  await expect(desktop.locator(".contract-packet").getByText("1 day")).toHaveCount(2);
  await desktop.getByRole("button", { name: "Copy Contract to" }).click();
  await expect(desktop.getByRole("button", { name: "Copy Contract to" })).toBeVisible();
  await expect(desktop.getByText(/pilots/i)).toBeVisible({ timeout: 15000 });
  await expect(desktop.getByText("Public ESI Route")).toHaveCount(0);
  await expect(desktop.getByText("History")).toHaveCount(0);
  await expect(desktop.getByText("Public-only ESI scope")).toHaveCount(0);
  await expect(desktop.getByText("Demo pricing model")).toHaveCount(0);
  await expect(desktop.getByText("Route Mode")).toHaveCount(0);
  await expect(desktop.getByText("Saved Quotes")).toHaveCount(0);
  await expect(desktop.getByText("Settings")).toHaveCount(0);
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
  await expect(desktop.getByRole("textbox", { name: "Collateral" })).toHaveValue("5,000,000,000");
  await desktop.getByRole("textbox", { name: "Collateral" }).fill("2.5B");
  await expect(desktop.locator(".contract-packet").getByText("2,500,000,000 ISK")).toBeVisible();
  await desktop.getByRole("textbox", { name: "Collateral" }).fill("6B");
  await expect(desktop.getByRole("textbox", { name: "Collateral" })).toHaveValue("5,000,000,000");

  await desktop.getByRole("combobox", { name: "Pick Up" }).fill("Jita");
  await desktop.getByRole("option", { name: /Jita/i }).click();
  await desktop.getByRole("combobox", { name: "Destination" }).fill("Amarr");
  await desktop.getByRole("option", { name: /Amarr/i }).click();
  const serviceAccent = await desktop.locator(".app-shell").evaluate((node) =>
    getComputedStyle(node).getPropertyValue("--service-accent").trim(),
  );
  if (serviceAccent.toLowerCase() !== "#6fcf97") {
    throw new Error(`Expected HighSec accent #6FCF97, got ${serviceAccent}`);
  }
  await desktop.waitForFunction(() => {
    const text = document.querySelector(".quote-lines")?.textContent ?? "";
    return !text.includes("0 jumps");
  }, null, { timeout: 15000 });
  await desktop.getByRole("button", { name: "800,000 m3" }).click();
  await expect(desktop.locator(".quote-lines").getByText("800,000 m3")).toBeVisible();
  await desktop.getByRole("button", { name: "Calculate Run" }).click();
  await desktop.waitForFunction(() => {
    const text = document.querySelector(".contract-packet")?.textContent ?? "";
    return text.includes("5,000,000,000 ISK");
  }, null, { timeout: 15000 });

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
  await desktop.screenshot({ path: "dev.logs/desktop.png", fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.evaluate(() => document.fonts.ready);
  await expect(mobile.getByRole("link", { name: "Solane Run dashboard" })).toBeVisible();
  await expect(mobile.getByText("Freight parameters")).toBeVisible();
  await expect(mobile.getByText("Route Overview")).toHaveCount(0);
  await expect(mobile.getByText("Quote Summary")).toBeVisible();
  await expect(mobile.getByRole("combobox", { name: "Pick Up" })).toHaveValue("");

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
