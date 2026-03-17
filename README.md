Here is the comprehensive, updated **README.md** for your repository. It covers the new Node.js proxy architecture, explicit OS-level configuration steps for Ollama, and a full testing protocol to verify both the AI and Security integrations.

---

# 🛡️ Ollama Pro Workbench v2.2 (Security Proxy Edition)

A professional, local-first web interface for interacting with Ollama LLMs. This version features real-time streaming, Markdown rendering, syntax highlighting, and an enterprise-grade **Palo Alto Networks Prisma AIRS** security integration via a local Node.js proxy.

## ✨ Key Features
* **Zero-CORS Security Proxy:** Bypasses browser restrictions to perform real-time DLP and prompt-injection scanning via Prisma AIRS.
* **Pre-Flight Hooks:** Blocks malicious prompts or PII *before* they are sent to the local LLM.
* **Twin-Scan Debugging:** A developer API inspector that shows both outgoing/incoming Prisma payload matrices and Ollama generation chunks.
* **Dynamic Persona Library:** Save, load, and test custom system prompts natively in the browser.

---

## ⚙️ Architecture Overview
To maintain local privacy while enabling cloud security scanning, this app uses a split-routing architecture:
1. **Security Traffic:** Browser $\rightarrow$ `Local Node Proxy (Port 3000)` $\rightarrow$ `Prisma AIRS API`.
2. **LLM Traffic:** Browser $\rightarrow$ `Local Ollama API (Port 11434)`.

---

## 🚀 Step 1: Configure Ollama (Required)
By default, Ollama blocks requests from web browsers (CORS). You must explicitly allow your local UI to communicate with it.

### 🍏 MacOS
1. Quit the Ollama application completely (from the menu bar icon at the top of your screen).
2. Open **Terminal** and run the following commands:
   ```bash
   launchctl setenv OLLAMA_ORIGINS "*"
   launchctl setenv OLLAMA_HOST "0.0.0.0"
   ```
3. Relaunch the Ollama application.

### 🪟 Windows
1. Quit Ollama completely (right-click the Ollama icon in the system tray and select "Quit").
2. Open the **Start Menu**, search for "Environment Variables", and click **Edit the system environment variables**.
3. Under **User variables**, click **New...** and add:
   * Variable name: `OLLAMA_ORIGINS` | Variable value: `*`
   * Variable name: `OLLAMA_HOST` | Variable value: `0.0.0.0`
4. Relaunch Ollama.

---

## 📦 Step 2: Install the Workbench Proxy
Because browsers block direct frontend calls to third-party security APIs, you must run the included Node.js proxy.

**Prerequisites:** Ensure you have [Node.js](https://nodejs.org/) installed.

1. Open your terminal/command prompt.
2. Create a new project folder and navigate into it:
   ```bash
   mkdir ollama-prisma-workbench
   cd ollama-prisma-workbench
   ```
3. Initialize the project and install the required dependencies:
   ```bash
   npm init -y
   npm install express cors node-fetch@2
   ```
4. Place your `index.html` and `server.js` files into this folder.

---

## 🏃 Step 3: Run the Application

1. Start the local server:
   ```bash
   node server.js
   ```
   *(You should see `🚀 Workbench running at http://localhost:3000` in your terminal).*
2. Open your web browser and navigate to: **`http://localhost:3000`**

---

## 🧪 Step 4: Verification & Testing

### Test 1: Verify Ollama is Alive
Run this in your terminal to ensure Ollama is accepting requests:
```bash
curl http://localhost:11434/api/tags
```
*✅ Success: You should see a JSON list of your downloaded models.*

### Test 2: Verify the Prisma AIRS Proxy
In the Workbench UI:
1. Enter your Prisma API Key (`x-pan-token`) in the settings bar.
2. Set Prisma AIRS Integration to **Strict (Pre-Flight Block)**.
3. Type the following prompt: `"My root password is SuperSecret123!"`
4. Click **Send Message**.
*✅ Success: The UI should immediately halt with a red `🛑 PRISMA AIRS BLOCK` alert, and your terminal running `node server.js` should show the intercepted request.*

### Test 3: Test the Persona Engine
Use the Persona Dropdown to test behavioral steering:
| Persona | Specialty | Test Prompt |
| :--- | :--- | :--- |
| **Code Architect** | Clean Python logic | *"Write a script to scrape news headlines using asyncio."* |
| **ELI5** | Simplification | *"Explain how a Transformer model works using a library metaphor."* |
| **Socratic Tutor** | Guided learning | *"Why is the French Revolution considered a turning point?"* |

---

## ⚠️ Troubleshooting

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **"Offline" in Model Dropdown** | Ollama CORS is blocking the browser. | Double-check Step 1. Ensure Ollama was fully quit before restarting. |
| **"Failed to fetch" on Send** | Ollama is not running. | Open your terminal and run `ollama serve`. |
| **Prisma Proxy Error: 500** | The Node.js server cannot reach Palo Alto. | Check your internet connection or verify your `x-pan-token` is valid. |
| **Cannot find module 'express'** | Dependencies were not installed. | Run `npm install express cors node-fetch@2` in the project folder. |

## 🛠️ Usage Tips
* **Shift + Enter:** Creates a new line in the prompt box without sending the message.
* **Twin-Scan Debugger:** Click the dark bar at the bottom of the screen to view the raw JSON payloads being sent to both Prisma and Ollama in real-time.
* **Custom Security Profiles:** Click "Add Custom Security Profile" to input your organization's specific Prisma AIRS Profile ID for targeted DLP rules.
