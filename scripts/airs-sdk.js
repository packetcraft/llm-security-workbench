#!/usr/bin/env node
// Launches services/airs-sdk/airs_sdk_server.py using the venv Python.
// Venv layout differs by OS: Scripts/ on Windows, bin/ on Unix.

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const root = path.join(__dirname, "..");
const isWindows = os.platform() === "win32";

const python = isWindows
  ? path.join(root, "services", "airs-sdk", ".venv", "Scripts", "python.exe")
  : path.join(root, "services", "airs-sdk", ".venv", "bin", "python");

const server = path.join(root, "services", "airs-sdk", "airs_sdk_server.py");

if (!fs.existsSync(python)) {
  console.error(`Python not found at: ${python}`);
  const venvCmd = isWindows
    ? "python -m venv services/airs-sdk/.venv"
    : "python3 -m venv services/airs-sdk/.venv";
  console.error(`Run: ${venvCmd} && pip install -r services/airs-sdk/requirements.txt`);
  process.exit(1);
}

const proc = spawn(python, [server], { stdio: "inherit", cwd: root });
proc.on("exit", (code) => process.exit(code ?? 0));
