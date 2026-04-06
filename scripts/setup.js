#!/usr/bin/env node
// scripts/setup.js
//
// Creates Python venvs and installs dependencies for all local sidecars.
// Run once after cloning: npm run setup
//
// Safe to re-run — skips any service whose venv already exists.
// AIRS Model Scan is excluded (requires private PyPI — see docs/GATE-AIRS-MODEL-SECURITY.md).

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const root = path.join(__dirname, "..");
const isWindows = os.platform() === "win32";

// ── colour helpers ────────────────────────────────────────────────────────────
const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

// ── services to set up ────────────────────────────────────────────────────────
// pythonExe + pythonArgs are used for `python -m venv`
// Using the venv's own python for pip install avoids pip path differences.

const services = [
  {
    name:        "llm-guard",
    dir:         "services/llm-guard",
    label:       "LLM-Guard",
    note:        "Python 3.12 required",
    pythonExe:   isWindows ? "py"      : "python3.12",
    pythonArgs:  isWindows ? ["-3.12"] : [],
  },
  {
    name:        "canary",
    dir:         "services/canary",
    label:       "Little-Canary",
    note:        "Python 3.9+",
    pythonExe:   isWindows ? "py"   : "python3",
    pythonArgs:  isWindows ? ["-3"] : [],
  },
  {
    name:        "airs-sdk",
    dir:         "services/airs-sdk",
    label:       "AIRS SDK sidecar",
    note:        "Python 3.9+",
    pythonExe:   isWindows ? "py"   : "python3",
    pythonArgs:  isWindows ? ["-3"] : [],
  },
];

// ── helpers ───────────────────────────────────────────────────────────────────
function venvPython(dir) {
  return isWindows
    ? path.join(root, dir, ".venv", "Scripts", "python.exe")
    : path.join(root, dir, ".venv", "bin", "python");
}

function run(exe, args) {
  const result = spawnSync(exe, args, { stdio: "inherit", cwd: root });
  return result.status === 0;
}

// ── main ──────────────────────────────────────────────────────────────────────
console.log(c.bold("\n🛡️  LLM Security Workbench — sidecar setup\n"));
console.log("Creates Python venvs and installs dependencies for local sidecars.");
console.log("Safe to re-run — venvs that already exist are skipped.\n");
console.log(c.dim("  Skipping: AIRS Model Scan — requires private PyPI"));
console.log(c.dim("            See docs/GATE-AIRS-MODEL-SECURITY.md to set it up separately.\n"));

let passed = 0;
let failed = 0;

for (const svc of services) {
  const python = venvPython(svc.dir);
  const requirements = path.join(root, svc.dir, "requirements.txt");

  console.log(c.bold(`── ${svc.label}  ${c.dim(`(${svc.note})`)}`));

  // ── step 1: create venv ──────────────────────────────────────────────────
  if (fs.existsSync(python)) {
    console.log(`   ${c.yellow("skip")}   venv already exists`);
  } else {
    console.log(`   ${c.bold("create")} venv...`);
    const ok = run(svc.pythonExe, [
      ...svc.pythonArgs,
      "-m", "venv",
      path.join(svc.dir, ".venv"),
    ]);

    if (!ok) {
      console.log(`   ${c.red("fail")}   could not create venv`);
      if (svc.name === "llm-guard") {
        console.log(`          ${c.red("LLM-Guard requires Python 3.12 exactly.")}`);
        console.log(`          Download: https://www.python.org/downloads/release/python-3129/`);
      } else {
        console.log(`          Is ${svc.pythonExe} installed and on PATH?`);
      }
      console.log();
      failed++;
      continue;
    }
    console.log(`   ${c.green("ok")}     venv created`);
  }

  // ── step 2: pip install ──────────────────────────────────────────────────
  console.log(`   ${c.bold("install")} dependencies...`);
  const ok = run(python, ["-m", "pip", "install", "--quiet", "-r", requirements]);

  if (!ok) {
    console.log(`   ${c.red("fail")}   pip install failed — see output above`);
    console.log();
    failed++;
    continue;
  }

  console.log(`   ${c.green("ok")}     dependencies installed\n`);
  passed++;
}

// ── summary ───────────────────────────────────────────────────────────────────
console.log(c.bold("── Summary ──────────────────────────────────────"));
if (failed === 0) {
  console.log(c.green(`   ✓ All ${passed} sidecars ready\n`));
  console.log("Next steps:");
  console.log("  1. Start Ollama:          ollama serve");
  console.log("  2. Start all services:    PYTHONUTF8=1 python -m honcho start");
  console.log("  3. Open the workbench:    http://localhost:3080/dev/8b\n");
} else {
  console.log(c.green(`   ✓ ${passed} succeeded`) + "   " + c.red(`✗ ${failed} failed`));
  console.log("\nFix the errors above and re-run: npm run setup\n");
  process.exit(1);
}
