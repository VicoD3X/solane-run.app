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
  await expect(desktop.getByRole("link", { name: "Solane Run calculator" })).toBeVisible();
  await expect(desktop.getByText("Freight quotation control")).toBeVisible();
  await expect(desktop.getByRole("heading", { name: "Freight parameters" })).toBeVisible();
  await expect(desktop.getByText("Core freight")).toBeVisible();
  await expect(desktop.getByText("Heavy lift / occasional")).toBeVisible();
  await expect(desktop.getByText("Contract Review")).toHaveCount(0);
  await expect(desktop.getByText("Route Intel")).toHaveCount(0);
  await expect(desktop.getByText("About")).toHaveCount(0);
  await expect(desktop.getByText(/traffic/i)).toHaveCount(0);
  await expect(desktop.getByRole("button", { name: "13,000 m3" })).toBeDisabled();
  await expect(desktop.getByRole("button", { name: "60,000 m3" })).toBeDisabled();
  await expect(desktop.getByRole("button", { name: /800,000 m3/ })).toBeDisabled();

  if (apiAvailable) {
    await desktop.getByRole("combobox", { name: "Pick Up" }).fill("Jita");
    await desktop.getByRole("option", { name: /Jita/i }).click();
    await desktop.getByRole("combobox", { name: "Destination" }).fill("Amarr");
    await desktop.getByRole("option", { name: /Amarr/i }).click();
    await expect(desktop.getByRole("button", { name: "13,000 m3" })).toBeEnabled({ timeout: 15000 });
    await expect(desktop.getByRole("button", { name: "60,000 m3" })).toBeEnabled();
    await expect(desktop.getByRole("button", { name: /800,000 m3/ })).toBeEnabled();
    await desktop.getByRole("button", { name: /800,000 m3/ }).click();
    await expect(desktop.getByText("Rush unavailable for 800,000 m3.")).toBeVisible();
    await expect(desktop.locator(".speed-toggle-button")).toBeDisabled();
    await expect(desktop.getByText("Contract Review")).toHaveCount(0);
    await desktop.getByRole("textbox", { name: "Collateral" }).fill("200000000");
    await expect(desktop.getByText("Contract Review")).toBeVisible({ timeout: 15000 });
    await expect(desktop.locator(".contract-packet").getByText("800,000 m3")).toBeVisible();
    await expect(desktop.getByRole("button", { name: "Copy Rewards" })).toBeVisible({ timeout: 15000 });
  }

  await assertNoOverflow(desktop, "Desktop");
  await desktop.screenshot({ path: "dev.logs/desktop.png", fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await mobile.evaluate(() => document.fonts.ready);
  await expect(mobile.getByText("Freight quotation control")).toBeVisible();
  await expect(mobile.getByText("Contract Review")).toHaveCount(0);
  await assertNoOverflow(mobile, "Mobile");
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

async function assertNoOverflow(page, label) {
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (horizontalOverflow > 1) {
    throw new Error(`${label} horizontal overflow detected: ${horizontalOverflow}px`);
  }
}
