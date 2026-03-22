#!/usr/bin/env node
// Launches llm-guard/llmguard_server.py using the venv Python.
// Venv layout differs by OS: Scripts/ on Windows, bin/ on Unix.

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const root = path.join(__dirname, "..");

const isWindows = os.platform() === "win32";

const python = isWindows
  ? path.join(root, "services", "llm-guard", ".venv", "Scripts", "python.exe")
  : path.join(root, "services", "llm-guard", ".venv", "bin", "python");

const server = path.join(root, "services", "llm-guard", "llmguard_server.py");

if (!fs.existsSync(python)) {
  console.error(`Python not found at: ${python}`);
  const venvCmd = isWindows
    ? "py -3.12 -m venv services/llm-guard/.venv"
    : "python3.12 -m venv services/llm-guard/.venv";
  console.error(`Run: ${venvCmd} && pip install -r services/llm-guard/requirements.txt`);
  process.exit(1);
}

const proc = spawn(python, [server], { stdio: "inherit", cwd: root });
proc.on("exit", (code) => process.exit(code ?? 0));
