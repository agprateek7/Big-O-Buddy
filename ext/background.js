// background.js — Gemini-ready, robust message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.code) {
        console.error("Background: No code received in message");
        sendResponse({ ok: false, error: "No code provided" });
        return true;
    }

    // Read config (apiKey, apiEndpoint, model) from storage
    chrome.storage.sync.get(['apiKey', 'apiEndpoint', 'model'], function(items) {
        const API_KEY = items.apiKey;
        // Default to Google Gemini endpoint base for models
        const BASE_URL = items.apiEndpoint || "https://generativelanguage.googleapis.com/v1beta/models";
        // Default to a sensible Gemini model (change as desired)
        const MODEL = items.model || "gemini-2.5-flash-lite";

        if (!API_KEY) {
            console.error("Background: No API key found in storage");
            sendResponse({ ok: false, error: "Please set your API key in the extension options" });
            return;
        }

        console.log("Background: Using API endpoint:", BASE_URL);
        console.log("Background: Using model:", MODEL);
        console.log("Background: Received code to analyze");

        // Build URL (Gemini expects API key in query param)
        const url = `${BASE_URL}/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(API_KEY)}`;

        // Build prompt instructing the model to output STRICT JSON
        const prompt = `
As an algorithm complexity analyzer, analyze the following code and provide the analysis in JSON format.

Important guidelines:
- Be precise with nested loops, recursion, and hash table operations.
- Consider amortized complexity where applicable.
- For hash tables, mention if you assume average case O(1) operations.
- For space complexity, calculate auxiliary space used by the algorithm (not including input size).

Code to analyze:
${message.code}

Return EXACTLY one JSON object and nothing else with this structure:
{
  "complexity": {
    "time": "<time complexity as a Big-O string or 'None'>",
    "space": "<space complexity as a Big-O string or 'None'>"
  },
  "explanation": "<brief technical explanation>"
}

If the code is incomplete or cannot be analyzed, return:
{
  "complexity": { "time": "None", "space": "None" },
  "explanation": "Code is incomplete"
}
`;

        // Gemini `generateContent` body using the 'contents' style (text part)
        const body = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt }
                    ]
                }
            ]
        };

        // Fire request
        (async () => {
            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                        // Note: Gemini uses API key in the query string for simple keys.
                        // If your deployment uses a different auth method, adapt accordingly.
                    },
                    body: JSON.stringify(body)
                });

                // Always retrieve raw text for debugging and robust parsing
                const rawText = await resp.text();
                console.log('Background: raw response status:', resp.status, resp.statusText);
                console.log('Background: raw response body:', rawText);

                // Try to parse response JSON if possible
                let parsed = null;
                try {
                    parsed = JSON.parse(rawText);
                } catch (e) {
                    // leave parsed null; the body might be plain text or malformed JSON
                }

                if (!resp.ok) {
                    // Server returned non-2xx — return structured error with server body if any
                    const serverError = parsed !== null ? parsed : rawText || `HTTP ${resp.status}`;
                    console.error('Background: API returned non-OK:', resp.status, serverError);

                    sendResponse({
                        ok: false,
                        status: resp.status,
                        statusText: resp.statusText || '',
                        serverError
                    });
                    return;
                }

                // Success path: extract text from Gemini response shape (candidates -> content -> parts -> text)
                // Different Gemini endpoints/versions may vary; we try multiple common shapes
                let contentText = null;

                if (parsed) {
                    // Try candidate-style
                    contentText = parsed.candidates?.[0]?.content?.parts?.[0]?.text
                        || parsed.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n')
                        || parsed.output?.[0]?.content?.[0]?.text; // fallback variations
                }

                // If parse failed or contentText not found, fallback to rawText
                if (!contentText) {
                    // Sometimes the service returns a plain text body (already rawText)
                    contentText = rawText && rawText.trim().length > 0 ? rawText : null;
                }

                if (!contentText) {
                    console.warn("Background: No textual content found in Gemini response");
                    sendResponse({ ok: false, error: "No content returned from Gemini", raw: parsed ?? rawText });
                    return;
                }

                // Send predictable response: payload is the textual result from Gemini
                sendResponse({ ok: true, payload: contentText });
            } catch (err) {
                console.error('Background: unexpected error calling API:', err && err.stack ? err.stack : err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        // Important: keep message channel open for async sendResponse
        return true;
    });
    
    // ensure listener returns true immediately for async response; in this structure we already return inside storage callback,
    // but return true here to be safe (Chrome expects boolean or undefined synchronously).
    return true;
});
