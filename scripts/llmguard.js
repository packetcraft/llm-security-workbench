#!/usr/bin/env node
// Launches llm-guard/llmguard_server.py using the venv Python.
// Works on Windows regardless of the hyphen in the directory name.
const { spawn } = require("child_process");
const path = require("path");

const root   = path.join(__dirname, "..");
const python = path.join(root, "llm-guard", ".venv", "Scripts", "python.exe");
const server = path.join(root, "llm-guard", "llmguard_server.py");

const proc = spawn(python, [server], { stdio: "inherit", cwd: root });
proc.on("exit", code => process.exit(code ?? 0));
