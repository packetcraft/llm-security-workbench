#!/usr/bin/env node
// stage.js — copies a /dev file to src/index.html by prefix match
// Searches dev/ first, then dev/builds/ (3x, 4x build history).
// Usage:  node scripts/stage.js 5b
//         npm run stage 5b
//         npm run stage:5b

const fs   = require("fs");
const path = require("path");

const root      = path.join(__dirname, "..");
const devDir    = path.join(root, "dev");
const buildsDir = path.join(devDir, "builds");
const dest      = path.join(root, "src", "index.html");

const prefix = process.argv[2];

// Collect files from dev/ and dev/builds/ with their source directory
const entries = [
  ...fs.readdirSync(devDir).filter(f => f.endsWith(".html")).sort().map(f => ({ f, dir: devDir, label: "dev" })),
  ...(fs.existsSync(buildsDir)
    ? fs.readdirSync(buildsDir).filter(f => f.endsWith(".html")).sort().map(f => ({ f, dir: buildsDir, label: "dev/builds" }))
    : []),
];

if (!prefix) {
  console.log("Usage: npm run stage <prefix>\n");
  console.log("Active files (dev/):");
  entries.filter(e => e.label === "dev").forEach(e => console.log(`  ${e.f}`));
  console.log("\nBuild history (dev/builds/):");
  entries.filter(e => e.label === "dev/builds").forEach(e => console.log(`  ${e.f}`));
  console.log("\nExamples:");
  console.log("  npm run stage 5b");
  console.log("  npm run stage:5b");
  process.exit(0);
}

const entry = entries.find(e => e.f.startsWith(prefix));

if (!entry) {
  console.error(`❌  No dev file found matching "${prefix}"`);
  console.error(`    Available: ${entries.map(e => e.f.replace(".html", "")).join(", ")}`);
  process.exit(1);
}

fs.copyFileSync(path.join(entry.dir, entry.f), dest);
console.log(`✅  Staged:  ${entry.label}/${entry.f}`);
console.log(`         →  src/index.html`);
console.log(`🌐  Open:   http://localhost:3080`);
