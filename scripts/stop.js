#!/usr/bin/env node
// scripts/stop.js
//
// Kills all workbench processes (Node proxy + Python sidecars).
// Use after Ctrl+C leaves orphaned processes in Git Bash on Windows.
// Run with: npm run stop

const { spawnSync } = require("child_process");
const os = require("os");

const isWindows = os.platform() === "win32";

const green = s => `\x1b[32m${s}\x1b[0m`;
const dim   = s => `\x1b[2m${s}\x1b[0m`;
const bold  = s => `\x1b[1m${s}\x1b[0m`;

console.log(bold("\n🛑  Stopping workbench processes...\n"));

if (isWindows) {
  const targets = [
    { label: "node.exe   (proxy :3080)",           exe: "node.exe"   },
    { label: "python.exe (sidecars :5001–5004)",   exe: "python.exe" },
  ];

  for (const t of targets) {
    // taskkill exit codes: 0 = killed, 128 = not found
    let result;
    try {
      result = spawnSync("taskkill", ["/F", "/IM", t.exe], { stdio: "pipe", shell: true });
    } catch (e) {
      console.log(`   ${dim("skip")}   ${t.label}  ${dim("(taskkill unavailable)")}`);
      continue;
    }
    if (result.status === 0) {
      console.log(`   ${green("killed")}  ${t.label}`);
    } else {
      console.log(`   ${dim("none")}   ${t.label}  ${dim("(not running)")}`);
    }
  }
} else {
  const targets = [
    { label: "node   (proxy :3080)",             pattern: "node src/server.js" },
    { label: "python (sidecars :5001–5004)",     pattern: "llmguard_server\\|canary_server\\|airs_sdk_server" },
  ];

  for (const t of targets) {
    const result = spawnSync("pkill", ["-f", t.pattern], { stdio: "pipe" });
    if (result.status === 0) {
      console.log(`   ${green("killed")}  ${t.label}`);
    } else {
      console.log(`   ${dim("none")}   ${t.label}  ${dim("(not running)")}`);
    }
  }
}

console.log(bold("\n   Done. Terminal is free.\n"));
