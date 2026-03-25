#!/usr/bin/env node
// Launches services/airs-model-scan/model_scan_server.py using the venv Python.
// Venv layout differs by OS: Scripts/ on Windows, bin/ on Unix.

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const root = path.join(__dirname, "..");

// Forward .env vars to the Python process
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

const isWindows = os.platform() === "win32";

const python = isWindows
  ? path.join(root, "services", "airs-model-scan", ".venv", "Scripts", "python.exe")
  : path.join(root, "services", "airs-model-scan", ".venv", "bin", "python");

const server = path.join(root, "services", "airs-model-scan", "model_scan_server.py");

if (!fs.existsSync(python)) {
  console.error(`Python not found at: ${python}`);
  const venvCmd = isWindows
    ? "py -3.12 -m venv services/airs-model-scan/.venv"
    : "python3.12 -m venv services/airs-model-scan/.venv";
  console.error(`Run: ${venvCmd}`);
  console.error(`Then follow the private PyPI install steps in docs/GATE-AIRS-MODEL-SECURITY.md`);
  process.exit(1);
}

const proc = spawn(python, [server], { stdio: "inherit", cwd: root });
proc.on("exit", (code) => process.exit(code ?? 0));
