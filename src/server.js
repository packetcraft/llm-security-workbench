const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// 1. Serve your custom index.html page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 2. The CORS-Bypassing Proxy for Prisma AIRS
app.post("/api/prisma", async (req, res) => {
  const prismaEndpoint =
    "https://service.api.aisecurity.paloaltonetworks.com/v1/scan/sync/request";

  // Extract the API key sent from your HTML frontend
  const apiKey = req.headers["x-pan-token"];

  if (!apiKey) {
    return res.status(401).json({ error: "Missing x-pan-token API Key" });
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
