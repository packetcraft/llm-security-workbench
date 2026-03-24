#!/usr/bin/env node
// Launches services/canary/canary_server.py using the venv Python.
// Venv layout differs by OS: Scripts/ on Windows, bin/ on Unix.

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const root = path.join(__dirname, "..");
const isWindows = os.platform() === "win32";

const python = isWindows
  ? path.join(root, "services", "canary", ".venv", "Scripts", "python.exe")
  : path.join(root, "services", "canary", ".venv", "bin", "python");

const server = path.join(root, "services", "canary", "canary_server.py");

if (!fs.existsSync(python)) {
  console.error(`\nLittle-Canary sidecar: Python venv not found at: ${python}`);
  console.error(`\nSet it up with:\n`);
  if (isWindows) {
    console.error(`  python -m venv services/canary/.venv`);
    console.error(`  services\\canary\\.venv\\Scripts\\pip install -r services/canary/requirements.txt`);
  } else {
    console.error(`  python3 -m venv services/canary/.venv`);
    console.error(`  services/canary/.venv/bin/pip install -r services/canary/requirements.txt`);
  }
  console.error(``);
  process.exit(1);
}

const proc = spawn(python, [server], { stdio: "inherit", cwd: root });
proc.on("exit", (code) => process.exit(code ?? 0));
