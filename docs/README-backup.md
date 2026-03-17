I’ve updated the **README.md** to include the persona laboratory guide, the manual `curl` verification steps for both MacOS and Windows, and the expanded troubleshooting matrix.

---

# 📂 README.md

### **Ollama Ultimate Workbench**

A professional, single-file web interface for interacting with local Ollama LLMs, featuring streaming, markdown rendering, code syntax highlighting, and a developer debug inspector.

---

## 🚀 Setup Instructions

### 1. Configure Ollama for Web Access (CORS)

By default, Ollama blocks requests from web browsers. You must enable **Cross-Origin Resource Sharing (CORS)**.

#### **MacOS**

1. Quit Ollama from the menu bar icon.
2. Open **Terminal** and run:
```bash
launchctl setenv OLLAMA_ORIGINS "*"
launchctl setenv OLLAMA_HOST "0.0.0.0"

```


3. Restart the Ollama application.

#### **Windows**

1. Quit Ollama from the system tray.
2. Search for "Environment Variables" in the Start Menu and select **Edit the system environment variables**.
3. Under **User variables**, click **New**:
* **Name:** `OLLAMA_ORIGINS` | **Value:** `*`
* **Name:** `OLLAMA_HOST` | **Value:** `0.0.0.0`


4. Restart Ollama.

---

## 🧪 Connection Testing (`curl`)

Before launching the HTML, verify your Ollama API is accessible using these terminal commands:

| **Test Case** | **Command** | **Expected Result** |
| --- | --- | --- |
| **Basic Heartbeat** | `curl http://localhost:11434/` | "Ollama is running" |
| **List Models** | `curl http://localhost:11434/api/tags` | JSON list of your downloaded models |
| **Test Chat API** | `curl http://localhost:11434/api/chat -d '{"model": "llama3.2", "messages": [{"role": "user", "content": "hi"}], "stream": false}'` | A JSON response containing "content": "Hello!" |

---

## 🎭 Persona Laboratory

Use the "Persona Selection" dropdown to test these specific use cases:

| **Persona** | **Specialty** | **Suggested Test Query** |
| --- | --- | --- |
| **Code Architect** | Clean Python logic & comments | "Write a script to scrape news headlines to CSV using asyncio." |
| **ELI5** | Complex concept simplification | "Explain how a Transformer model works using a library metaphor." |
| **Security Auditor** | Vulnerability scanning (Red Team) | "Check this for SQLi: `query = 'SELECT * FROM users WHERE id=' + id`" |
| **Database Guru** | SQL optimization | "Generate an optimized query to find top 5 spenders in the last 90 days." |
| **Socratic Tutor** | Guided learning via questions | "Why is the French Revolution considered a turning point?" |
| **Refiner** | Executive-level editing | "[Paste raw notes] -> Turn this into a professional update for my VP." |

---

## ⚠️ Troubleshooting

| **Issue** | **Cause** | **Fix** |
| --- | --- | --- |
| **Failed to fetch** | CORS is blocked or Ollama is down. | Run the `launchctl` (Mac) or Env Var (Win) steps above and restart Ollama. |
| **Model not found** | The selected model isn't downloaded. | Run `ollama pull llama3.2` or choose a model that appears in `ollama list`. |
| **Blank Screen** | JavaScript Error. | Right-click > Inspect > Console to see the specific error. |
| **Unterminated JSON** | Rapid streaming data collision. | Ensure you are using the latest version with the **JSON Buffer Fix**. |
| **Model list "Loading..."** | Network timeout or CORS. | Click the "Refresh List" button or check the API Inspector (Debug View). |

---

## 🛠️ Usage Tips

* **Shift + Enter:** Use this to create new lines in your prompt without sending the message.
* **Debug View:** Open the **API Inspector** at the bottom to see the exact JSON being sent to your local Mac/PC.
* **Saving Personas:** Write a custom system prompt and click "Save as Custom" to keep it in your dropdown permanently.

---
