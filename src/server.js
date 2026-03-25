require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// 1. Serve your custom index.html page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 1b. Serve /test static files (e.g. sample_threats.json)
app.use('/test', express.static(path.join(__dirname, '..', 'test')));

// 1c. Serve any dev file by prefix — e.g. GET /dev/3c serves the first
//     file in /dev (or dev/builds/) whose name starts with "3c".
//     Active files (1x, 2x, 5x) live in /dev; build history (3x, 4x) in /dev/builds/.
app.get("/dev/:prefix", (req, res) => {
  const devDir    = path.join(__dirname, "..", "dev");
  const buildsDir = path.join(devDir, "builds");
  const prefix    = req.params.prefix;

  // Check dev/ first, then dev/builds/
  const searchDirs = [
    { dir: devDir,    label: "dev" },
    { dir: buildsDir, label: "dev/builds" },
  ];

  for (const { dir } of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".html"));
    const match = files.find(f => f.startsWith(prefix));
    if (match) return res.sendFile(path.join(dir, match));
  }

  // Not found — list all available files across both dirs
  const allFiles = searchDirs.flatMap(({ dir, label }) =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir).filter(f => f.endsWith(".html")).map(f => ({ f, label }))
      : []
  );
  res.status(404).send(
    `No dev file found matching "<b>${prefix}</b>".<br>Available: ` +
    allFiles.map(({ f, label }) => `<a href="/dev/${f.split("-")[0]}">${f}</a> <small>(${label})</small>`).join(", ")
  );
});

// 2. Expose non-sensitive config to the frontend (never exposes the key itself)
app.get("/api/config", (req, res) => {
  res.json({
    hasApiKey: !!process.env.AIRS_API_KEY,
    profile:   process.env.AIRS_PROFILE || null,
  });
});

// 3. Little Canary proxy — forwards to the local Python microservice on :5001
app.post("/api/canary", async (req, res) => {
  try {
    const response = await fetch("http://localhost:5001/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Little Canary service unavailable — is python/canary_server.py running? " + err.message });
  }
});

// 4. LLM Guard proxy — forwards to the local Python sidecar on :5002
//    /api/llmguard-input  → POST http://localhost:5002/scan/input
//    /api/llmguard-output → POST http://localhost:5002/scan/output
app.post("/api/llmguard-input", async (req, res) => {
  try {
    const response = await fetch("http://localhost:5002/scan/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "LLM Guard service unavailable — is llm-guard/llmguard_server.py running? " + err.message });
  }
});

app.post("/api/llmguard-output", async (req, res) => {
  try {
    const response = await fetch("http://localhost:5002/scan/output", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "LLM Guard service unavailable — is llm-guard/llmguard_server.py running? " + err.message });
  }
});

// 5. The CORS-Bypassing Proxy for AIRS
app.post("/api/prisma", async (req, res) => {
  const prismaEndpoint =
    "https://service.api.aisecurity.paloaltonetworks.com/v1/scan/sync/request";

  // Prefer .env key; fall back to key sent from the UI
  const apiKey = process.env.AIRS_API_KEY || req.headers["x-pan-token"];

  if (!apiKey) {
    return res.status(401).json({ error: "Missing x-pan-token — set AIRS_API_KEY in .env or enter it in the UI" });
  }

  try {
    // The Node backend makes the request, bypassing browser CORS completely
    const response = await fetch(prismaEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pan-token": apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data); // Send the successful security report back to your HTML
  } catch (error) {
    res.status(500).json({ error: "Proxy Error: " + error.message });
  }
});


// 6a. Sidecar health checks — used by the Security Pipeline status dots in the UI
app.get("/api/canary/health", async (req, res) => {
  try {
    const response = await fetch("http://localhost:5001/health");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ status: "offline", error: "Little-Canary unavailable — is services/canary/canary_server.py running? " + err.message });
  }
});

app.get("/api/llmguard/health", async (req, res) => {
  try {
    const response = await fetch("http://localhost:5002/health");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ status: "offline", error: "LLM-Guard unavailable — is services/llm-guard/llmguard_server.py running? " + err.message });
  }
});

// 6b. AIRS SDK proxy — forwards to Python sidecar on :5003
app.get("/api/airs-sdk/health", async (req, res) => {
  try {
    const response = await fetch("http://localhost:5003/health");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ sdk_available: false, error: "AIRS SDK sidecar unavailable — is services/airs-sdk/airs_sdk_server.py running? " + err.message });
  }
});

app.post("/api/airs-sdk/sync", async (req, res) => {
  const apiKey = process.env.AIRS_API_KEY || req.headers["x-pan-token"];
  if (!apiKey) {
    return res.status(401).json({ error: "Missing API key — set AIRS_API_KEY in .env" });
  }
  try {
    const body = { ...req.body, api_key: apiKey };
    const response = await fetch("http://localhost:5003/scan/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "AIRS SDK sidecar unavailable — is services/airs-sdk/airs_sdk_server.py running? " + err.message });
  }
});

app.post("/api/airs-sdk/batch", async (req, res) => {
  const apiKey = process.env.AIRS_API_KEY || req.headers["x-pan-token"];
  if (!apiKey) {
    return res.status(401).json({ error: "Missing API key — set AIRS_API_KEY in .env" });
  }
  try {
    const body = { ...req.body, api_key: apiKey };
    const response = await fetch("http://localhost:5003/scan/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "AIRS SDK sidecar unavailable — is services/airs-sdk/airs_sdk_server.py running? " + err.message });
  }
});


// 7. AIRS Model Security — proxies to the Python SDK sidecar on :5004
app.get("/api/model-scan/health", async (req, res) => {
  try {
    const response = await fetch("http://localhost:5004/health");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ status: "offline", error: "AIRS Model Scan sidecar unavailable — is model_scan_server.py running? " + err.message });
  }
});

app.post("/api/model-scan", async (req, res) => {
  try {
    const response = await fetch("http://localhost:5004/scan/hf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "AIRS Model Scan sidecar unavailable — run `npm run model-scan` in a separate terminal. " + err.message });
  }
});


const PORT = 3080;
app.listen(PORT, () => {
  console.log(`🚀 Workbench running at http://localhost:${PORT}`);
  console.log(`☁️ AIRS Proxy active on /api/prisma`);
  console.log(`🐍 AIRS SDK Proxy active on /api/airs-sdk/*`);
});
