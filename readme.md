# LeetCode Complexity Analyzer

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue)
![Made with Gemini](https://img.shields.io/badge/Made%20with-Gemini-ffca28)
![License: MIT](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

Analyze time & space complexity directly on LeetCode and NeetCode — fast, simple, and integrated into your browser.

**LeetCode Complexity Analyzer** is a Chrome extension that helps developers instantly understand the time and space complexity of code written in online editors (LeetCode / NeetCode). The extension sends your code to Google’s Gemini (Generative Language API) and displays a concise complexity summary and a short technical explanation in a LeetCode-style modal.

---

## Features

- 🚀 **Instant Complexity Analysis** — Get time & space complexity and a short explanation while you code.  
- 🎨 **Native-feeling UI** — “Analyze Code” button integrated near Run/Submit controls and a LeetCode-style modal for results.  
- 📊 **Structured output** — The model is prompted to return a fixed JSON structure so parsing is consistent.  
- ⚡ **Fast defaults** — Defaults to `gemini-1.5-flash` for low-latency responses and lower token use; `gemini-1.5-pro` is available for deeper reasoning.  
- 🌍 **Multi-language support** — Works with languages supported by LeetCode / NeetCode.  
- 🔒 **Local key storage** — Your Gemini API key is stored in `chrome.storage` in your browser only.

---

## Expected Output Format

```json
{
  "complexity": {
    "time": "<Big-O string or 'None'>",
    "space": "<Big-O string or 'None'>"
  },
  "explanation": "<brief technical explanation>"
}
```

If the code is incomplete:

```json
{
  "complexity": { "time": "None", "space": "None" },
  "explanation": "Code is incomplete"
}
```

---

## Installation (Manual)

1. Clone the repo:
   ```bash
   git clone https://github.com/agprateek7/Big-O-Buddy.git
   cd Big-O Buddy
   ```
2. Open Chrome → `chrome://extensions`  
3. Enable **Developer mode**  
4. Click **Load unpacked** and select the repository folder  

---

## Setup (Gemini API)

This extension uses Google’s **Generative Language API (Gemini)**. You need an API key.

### 1. Create API key
1. Go to Google Cloud Console → create a project  
2. Enable **Generative Language API**  
3. Create credentials → API key  
4. Copy your API key  

### 2. Configure in extension
- Right-click the extension icon → Options  
- Paste your API key  
- Choose a model (`gemini-1.5-flash` recommended for speed)  
- Save  

---

## Usage

1. Open a LeetCode/NeetCode problem page  
2. Write your solution in the editor  
3. Click **Analyze Code** (button near Submit/Run)  
4. A modal shows:
   - Time complexity  
   - Space complexity  
   - Explanation  

---

## Troubleshooting

- **`Model name is required`** → Set a model (`gemini-1.5-flash`) in Options  
- **Quota errors (429)** → You hit free-tier limits; enable billing or wait  
- **No code found** → Ensure you’re on a problem page with an editor open  
- Check extension logs via `chrome://extensions → Inspect service worker`  

---

## Security & Privacy

- 🔐 Code is sent to **Google Gemini API** for analysis  
- 🔑 API key stored locally in `chrome.storage`  
- 🛡️ Extension does **not** collect or transmit data elsewhere  

---

## Permissions

- `activeTab` — read current tab when analyzing  
- `storage` — store API key locally  
- `scripting` — inject scripts into pages  
- Host permissions for LeetCode

---

## License

This project is licensed under the **MIT License**.

---
