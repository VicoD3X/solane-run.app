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
  await expect(desktop.getByText("Route Overview")).toBeVisible();
  await expect(desktop.getByText("Quote Summary")).toBeVisible();
  await expect(desktop.getByText("BETA")).toBeVisible();
  await expect(desktop.getByText(/pilots/i)).toBeVisible({ timeout: 15000 });
  await expect(desktop.getByText("Public ESI Route")).toHaveCount(0);
  await expect(desktop.getByText("History")).toHaveCount(0);
  await expect(desktop.getByText("Public-only ESI scope")).toHaveCount(0);
  await expect(desktop.getByText("Demo pricing model")).toHaveCount(0);
  await expect(desktop.getByText("Route Mode")).toHaveCount(0);
  await expect(desktop.getByText("Saved Quotes")).toHaveCount(0);
  await expect(desktop.getByText("Settings")).toHaveCount(0);
  await expect(desktop.getByText("Coming soon")).toHaveCount(0);
  await expect(desktop.getByRole("combobox", { name: "Pick Up" })).toHaveValue("");
  await expect(desktop.getByRole("combobox", { name: "Destination" })).toHaveValue("");
  await expect(desktop.getByLabel("Volume")).toHaveCount(0);
  await expect(desktop.getByLabel("Collateral")).toHaveCount(0);

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
  await expect(desktop.getByText(/Route calculated automatically/i)).toBeVisible({ timeout: 15000 });
  await desktop.getByRole("button", { name: "800,000 m3" }).click();
  await expect(desktop.getByText(/Quote refreshed automatically/i)).toBeVisible();
  await desktop.getByRole("button", { name: "Calculate Run" }).click();
  await expect(desktop.getByText(/Route refreshed manually/i)).toBeVisible({ timeout: 15000 });
  await expect(desktop.locator(".collateral-readout").getByText("5.00B ISK")).toBeVisible();

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
  await expect(mobile.getByText("Route Overview")).toBeVisible();
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
