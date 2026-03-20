#!/usr/bin/env node
// Launches llm-guard/llmguard_server.py using the venv Python.
// Works on Windows regardless of the hyphen in the directory name.
// Virtual environments are structured differently depending on the operating system to match the native conventions of that system.
// Windows: Uses Scripts/ because Windows historically groups executables that way.
// macOS/Linux: Uses bin/ (short for binary) to follow the Unix Filesystem Hierarchy Standard.

const { spawn } = require("child_process");
const path = require("path");
const os = require("os"); // Added this to detect OS

const root = path.join(__dirname, "..");

// Detect if running on Windows
const isWindows = os.platform() === "win32";

// Set the path dynamically
const python = isWindows
  ? path.join(root, "llm-guard", ".venv", "Scripts", "python.exe")
  : path.join(root, "llm-guard", ".venv", "bin", "python");

const server = path.join(root, "llm-guard", "llmguard_server.py");

const proc = spawn(python, [server], { stdio: "inherit", cwd: root });
proc.on("exit", (code) => process.exit(code ?? 0));
