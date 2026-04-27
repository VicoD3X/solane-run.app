import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { HtmlValidate } from "html-validate";

const baseUrl = process.env.VITE_SMOKE_BASE_URL ?? "http://127.0.0.1:5173";
const htmlvalidate = new HtmlValidate({
  extends: ["html-validate:recommended"],
  rules: {
    "no-inline-style": "off",
    "no-trailing-whitespace": "off",
    "prefer-native-element": "off",
    "svg-focusable": "off",
  },
});
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const html = (await page.content()).trimEnd();
  await mkdir("dev.logs", { recursive: true });
  await writeFile("dev.logs/w3c-runtime.html", html, "utf8");

  const report = await htmlvalidate.validateString(html, "dev.logs/w3c-runtime.html");
  if (!report.valid) {
    const messages = report.results.flatMap((result) =>
      result.messages.map((message) =>
        `${result.filePath}:${message.line}:${message.column} ${message.severity === 2 ? "error" : "warn"} ${message.ruleId} ${message.message}`,
      ),
    );
    throw new Error(`HTML validation failed:\n${messages.join("\n")}`);
  }

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  if (accessibility.violations.length > 0) {
    const messages = accessibility.violations.map((violation) => {
      const nodes = violation.nodes
        .slice(0, 3)
        .map((node) => `    - ${node.target.join(" ")}: ${node.failureSummary?.replace(/\s+/g, " ").trim()}`)
        .join("\n");
      return `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help}\n${nodes}`;
    });
    throw new Error(`Accessibility validation failed:\n${messages.join("\n\n")}`);
  }
} finally {
  await browser.close();
}
