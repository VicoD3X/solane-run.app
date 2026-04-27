import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "apps", "web", "src");
const distRoot = path.join(repoRoot, "apps", "web", "dist");
const indexPath = path.join(repoRoot, "apps", "web", "index.html");
const nginxPath = path.join(repoRoot, "infra", "nginx", "default.conf");

const forbiddenSourcePatterns = [
  { pattern: /\bdangerouslySetInnerHTML\b/, label: "dangerouslySetInnerHTML" },
  { pattern: /\binnerHTML\b/, label: "innerHTML" },
  { pattern: /\bouterHTML\b/, label: "outerHTML" },
  { pattern: /\bdocument\.write\b/, label: "document.write" },
  { pattern: /\beval\s*\(/, label: "eval" },
  { pattern: /\bnew\s+Function\b/, label: "new Function" },
  { pattern: /\blocalStorage\b/, label: "localStorage" },
  { pattern: /\bsessionStorage\b/, label: "sessionStorage" },
];

const sensitivePatterns = [
  { pattern: /EVE_CLIENT_SECRET/i, label: "EVE_CLIENT_SECRET" },
  { pattern: /CLIENT_SECRET/i, label: "CLIENT_SECRET" },
  { pattern: /refresh_token/i, label: "refresh_token" },
  { pattern: /access_token/i, label: "access_token" },
  { pattern: /eat_[A-Za-z0-9_-]{20,}/, label: "EVE secret-like token" },
];

const failures = [];

for (const filePath of await listFiles(sourceRoot)) {
  if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) {
    continue;
  }

  const content = await readFile(filePath, "utf8");
  for (const check of forbiddenSourcePatterns) {
    if (check.pattern.test(content)) {
      failures.push(`${relative(filePath)} uses ${check.label}`);
    }
  }
}

for (const filePath of [
  ...(await listFiles(path.join(repoRoot, "apps", "web"))),
  ...(await listFiles(path.join(repoRoot, "infra"))),
  ...(await listFiles(path.join(repoRoot, "docs"))),
  path.join(repoRoot, "README.md"),
  path.join(repoRoot, ".env.example"),
]) {
  if (filePath.includes(`${path.sep}node_modules${path.sep}`) || filePath.includes(`${path.sep}dist${path.sep}`)) {
    continue;
  }

  const content = await readFile(filePath, "utf8").catch(() => "");
  for (const check of sensitivePatterns) {
    if (check.pattern.test(content)) {
      failures.push(`${relative(filePath)} contains ${check.label}`);
    }
  }
}

const indexHtml = await readFile(indexPath, "utf8");
const nginxConfig = await readFile(nginxPath, "utf8");
const requiredCspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'self'",
];

for (const directive of requiredCspDirectives) {
  if (!indexHtml.includes(directive)) {
    failures.push(`apps/web/index.html missing CSP directive: ${directive}`);
  }
  if (!nginxConfig.includes(directive)) {
    failures.push(`infra/nginx/default.conf missing CSP directive: ${directive}`);
  }
}

for (const requiredHeader of [
  "Content-Security-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
]) {
  if (!nginxConfig.includes(requiredHeader)) {
    failures.push(`infra/nginx/default.conf missing header: ${requiredHeader}`);
  }
}

if (await exists(distRoot)) {
  for (const filePath of await listFiles(distRoot)) {
    if (filePath.endsWith(".map")) {
      failures.push(`production sourcemap found: ${relative(filePath)}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Security validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
}

async function listFiles(root) {
  if (!(await exists(root))) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return listFiles(entryPath);
    }
    return entryPath;
  }));

  return files.flat();
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}
