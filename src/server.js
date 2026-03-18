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

// 1b. Serve any dev file by prefix — e.g. GET /dev/4a serves the first
//     file in /dev whose name starts with "4a". AIRS proxy still works.
app.get("/dev/:prefix", (req, res) => {
  const devDir = path.join(__dirname, "..", "dev");
  const prefix = req.params.prefix;
  const files = fs.readdirSync(devDir).filter(f => f.endsWith(".html"));
  const match = files.find(f => f.startsWith(prefix));
  if (!match) {
    return res.status(404).send(
      `No dev file found matching "<b>${prefix}</b>".<br>Available: ${files.map(f => `<a href="/dev/${f.split("-")[0]}">${f}</a>`).join(", ")}`
    );
  }
  res.sendFile(path.join(devDir, match));
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

// 4. The CORS-Bypassing Proxy for Prisma AIRS
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

const PORT = 3080;
app.listen(PORT, () => {
  console.log(`🚀 Workbench running at http://localhost:${PORT}`);
  console.log(`🛡️ Prisma AIRS Proxy active on /api/prisma`);
});
