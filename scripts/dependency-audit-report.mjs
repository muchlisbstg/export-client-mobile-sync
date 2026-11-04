#!/usr/bin/env node
import fs from "node:fs";

const [fullPath, productionPath] = process.argv.slice(2);
if (!fullPath || !productionPath) {
  console.error("Usage: node scripts/dependency-audit-report.mjs <full-audit.json> <production-audit.json>");
  process.exit(2);
}
function readAudit(path) {
  try { return JSON.parse(fs.readFileSync(path, "utf8")); }
  catch (error) { return { error: String(error), vulnerabilities: {} }; }
}
const full = readAudit(fullPath);
const production = readAudit(productionPath);
const severities = ["critical", "high", "moderate", "low", "info"];
const counts = full.metadata?.vulnerabilities ?? {};
const prodCounts = production.metadata?.vulnerabilities ?? {};
const entries = Object.entries(full.vulnerabilities ?? {}).sort(([a], [b]) => a.localeCompare(b));
const lines = [
  "# Dependency Security Audit",
  "",
  "- Generated (UTC): " + new Date().toISOString(),
  "- Repository revision: " + (process.env.GITHUB_SHA ?? "local/unspecified"),
  "- Node: " + process.version,
  "- Source: npm audit JSON against the committed package-lock.json",
  "",
  "## Executive summary",
  "",
  "| Severity | Full dependency tree | Production-only tree |",
  "|---|---:|---:|",
  ...severities.map((severity) => "| " + severity + " | " + (counts[severity] ?? 0) + " | " + (prodCounts[severity] ?? 0) + " |"),
  "| **Total advisories by affected package** | **" + (counts.total ?? entries.length) + "** | **" + (prodCounts.total ?? "n/a") + "** |",
  "",
  "> Counts are npm's vulnerability counts for affected package entries, not a count of unique CVEs. Transitive paths can cause one advisory to affect multiple dependency paths.",
  "",
  "## Affected packages and remediation",
  ""
];
if (!entries.length) {
  lines.push("No vulnerable package entries were returned by npm audit for the full dependency tree.");
} else {
  for (const [name, item] of entries) {
    const via = (item.via ?? []).map((v) => typeof v === "string" ? v : (v.title ?? v.name ?? "Advisory") + " (CVE: " + (v.cve ?? "not assigned") + "; range: " + (v.range ?? "not specified") + "; URL: " + (v.url ?? "not provided") + ")");
    const fix = item.fixAvailable === true ? "Automated fix reported available" :
      item.fixAvailable === false ? "No automated fix reported" :
      item.fixAvailable ? "Fix reported: " + JSON.stringify(item.fixAvailable) : "Fix availability not reported";
    lines.push(
      "### " + name, "",
      "- Severity: **" + (item.severity ?? "unknown") + "**",
      "- Direct dependency: " + (item.isDirect ? "yes" : "no (transitive)"),
      "- Affected range: " + (item.range ?? "not reported"),
      "- Installed versions: " + ((item.nodes ?? []).join(", ") || "not reported"),
      "- Remediation: " + fix,
      "- Advisory chain: " + (via.join("; ") || "not reported"),
      "- Dependents: " + ((item.effects ?? []).join(", ") || "none listed"),
      ""
    );
  }
}
lines.push(
  "## Risk assessment and remediation policy", "",
  "1. Prioritize **critical** and **high** findings, especially packages reachable from production dependency paths.",
  "2. For each finding, confirm the vulnerable version range, reachable code path, runtime exposure, and first patched version from the linked advisory before upgrading.",
  "3. Prefer the smallest compatible patch/minor update; regenerate the lockfile in an isolated branch and run unit, type, Expo compatibility, Android, iOS, and three-backend interoperability checks.",
  "4. Do not use npm audit fix --force as a blanket remediation. It may introduce breaking major-version changes.",
  "5. Re-run full and production-only audits after remediation and record remaining accepted risks with owner and expiry.",
  "",
  "## Scope and limitations", "",
  "- This report covers the dependency graph represented by the committed npm lockfile.",
  "- npm audit metadata is advisory intelligence, not proof of exploitability in this application.",
  "- It does not cover CocoaPods, Xcode toolchain components, OS packages, runtime configuration, secrets, or source-code vulnerabilities.",
  "- A clean audit does not replace code review, SBOM review, or application security testing.",
  "",
  "## Raw evidence", "",
  "- Full audit JSON: " + fullPath,
  "- Production-only audit JSON: " + productionPath,
  ""
);
const report = lines.join("\n");
fs.writeFileSync("dependency-audit-report.md", report);
console.log(report);
if ((counts.high ?? 0) > 0 || (counts.critical ?? 0) > 0) {
  console.error("HIGH/CRITICAL dependency advisories remain; workflow is marked failed for remediation tracking.");
  process.exitCode = 1;
}
