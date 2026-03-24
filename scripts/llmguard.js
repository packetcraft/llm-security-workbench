#!/usr/bin/env node
// Launches llm-guard/llmguard_server.py using the venv Python.
// Venv layout differs by OS: Scripts/ on Windows, bin/ on Unix.

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const root = path.join(__dirname, "..");

// Load .env so HF_HUB_OFFLINE / TRANSFORMERS_OFFLINE are forwarded to Python
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

const args = [server, ...process.argv.slice(2)];
const proc = spawn(python, args, { stdio: "inherit", cwd: root });
proc.on("exit", (code) => process.exit(code ?? 0));
