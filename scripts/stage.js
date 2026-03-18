#!/usr/bin/env node
// stage.js — copies a /dev file to src/index.html by prefix match
// Usage:  node scripts/stage.js 4a
//         npm run stage 4a
//         npm run stage:4a

const fs   = require("fs");
const path = require("path");

const root   = path.join(__dirname, "..");
const devDir = path.join(root, "dev");
const dest   = path.join(root, "src", "index.html");

const prefix = process.argv[2];
const files  = fs.readdirSync(devDir).filter(f => f.endsWith(".html")).sort();

if (!prefix) {
  console.log("Usage: npm run stage <prefix>\n");
  console.log("Available dev files:");
  files.forEach(f => console.log(`  ${f}`));
  console.log("\nExamples:");
  console.log("  npm run stage 4a");
  console.log("  npm run stage:4a");
  process.exit(0);
}

const match = files.find(f => f.startsWith(prefix));

if (!match) {
  console.error(`❌  No dev file found matching "${prefix}"`);
  console.error(`    Available: ${files.map(f => f.replace(".html", "")).join(", ")}`);
  process.exit(1);
}

fs.copyFileSync(path.join(devDir, match), dest);
console.log(`✅  Staged:  dev/${match}`);
console.log(`         →  src/index.html`);
console.log(`🌐  Open:   http://localhost:3080`);
